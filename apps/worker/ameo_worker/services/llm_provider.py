from __future__ import annotations

import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:  # pragma: no cover
    ChatGoogleGenerativeAI = None  # type: ignore[misc, assignment]

from ..models import ActionPlan, ObservationSnapshot
from ..settings import Settings
from .event_store import EventStore, EventType
from .rules_planner import build_rules_action_plan

_CIRCUIT_BREAKERS: Dict[str, float] = {}
_CIRCUIT_COOLDOWN_SEC = 60.0


def _is_circuit_open(provider: str) -> bool:
    until = _CIRCUIT_BREAKERS.get(provider)
    if until is None:
        return False
    if time.monotonic() >= until:
        _CIRCUIT_BREAKERS.pop(provider, None)
        return False
    return True


def _trip_circuit(provider: str, cooldown_sec: float = _CIRCUIT_COOLDOWN_SEC) -> None:
    _CIRCUIT_BREAKERS[provider] = time.monotonic() + cooldown_sec


def get_circuit_breaker_status() -> Dict[str, Any]:
    now = time.monotonic()
    open_providers = [
        name for name, until in _CIRCUIT_BREAKERS.items() if until > now
    ]
    return {
        "open_providers": open_providers,
        "cooldown_sec": _CIRCUIT_COOLDOWN_SEC,
    }


_CHAIN_STATUS: Dict[str, Any] = {
    "active_provider": "groq",
    "available_providers": ["groq", "z_ai", "gemini", "local_rules"],
    "last_failover_at": None,
    "total_failovers_24h": 0,
    "_failover_timestamps": [],
}


class LlmProviderError(RuntimeError):
    """Structured LLM failure — never swallowed or auto-fallback."""

    def __init__(
        self,
        *,
        provider: str,
        model: str,
        message: str,
        status_code: Optional[int] = None,
        error_code: Optional[str] = None,
        retryable: bool = False,
    ) -> None:
        self.provider = provider
        self.model = model
        self.status_code = status_code
        self.error_code = error_code
        self.retryable = retryable
        super().__init__(message)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "provider": self.provider,
            "model": self.model,
            "message": str(self),
            "status_code": self.status_code,
            "error_code": self.error_code,
            "retryable": self.retryable,
        }


def _extract_api_error(exc: Exception, *, provider: str, model: str) -> LlmProviderError:
    status_code: Optional[int] = None
    error_code: Optional[str] = None
    message = str(exc)
    retryable = False

    response = getattr(exc, "response", None)
    if response is not None:
        status_code = getattr(response, "status_code", None)

    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        err = body.get("error")
        if isinstance(err, dict):
            error_code = str(err.get("code") or err.get("type") or "")
            message = str(err.get("message") or message)

    name = exc.__class__.__name__.lower()
    if status_code in (402, 403, 429) or "ratelimit" in name or "insufficient" in message.lower():
        retryable = status_code == 429
    if "authentication" in name or status_code == 401:
        retryable = False

    return LlmProviderError(
        provider=provider,
        model=model,
        message=message,
        status_code=status_code,
        error_code=error_code or None,
        retryable=retryable,
    )


class LlmProvider(ABC):
    @property
    @abstractmethod
    def provider(self) -> str:
        raise NotImplementedError

    @property
    def display_provider(self) -> str:
        """Public name for diagnostics (sponsor-facing)."""
        return "zai" if self.provider == "z_ai" else self.provider

    @property
    @abstractmethod
    def model(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def build_chat_model(self) -> BaseChatModel:
        raise NotImplementedError

    async def ping(self) -> Dict[str, Any]:
        started = time.perf_counter()
        try:
            llm = self.build_chat_model()
            await llm.ainvoke([HumanMessage(content="ping")])
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            return {
                "provider": self.display_provider,
                "model": self.model,
                "ok": True,
                "ms": elapsed_ms,
            }
        except Exception as exc:
            elapsed_ms = int((time.perf_counter() - started) * 1000)
            if isinstance(exc, LlmProviderError):
                err = exc
            else:
                err = _extract_api_error(exc, provider=self.provider, model=self.model)
            return {
                "provider": self.display_provider,
                "model": self.model,
                "ok": False,
                "ms": elapsed_ms,
                "error": err.to_dict(),
            }


class ZaiProvider(LlmProvider):
    def __init__(self, settings: Settings) -> None:
        if not settings.z_ai_api_key:
            raise LlmProviderError(
                provider="z_ai",
                model=settings.z_ai_model,
                message="Z_AI_API_KEY is required for z_ai provider",
            )
        self._settings = settings

    @property
    def provider(self) -> str:
        return "z_ai"

    @property
    def model(self) -> str:
        return self._settings.z_ai_model

    def build_chat_model(self) -> BaseChatModel:
        return ChatOpenAI(
            model=self._settings.z_ai_model,
            api_key=self._settings.z_ai_api_key,
            base_url=self._settings.z_ai_base_url,
            temperature=0.2,
        )


class GroqProvider(LlmProvider):
    def __init__(self, settings: Settings) -> None:
        if not settings.groq_api_key:
            raise LlmProviderError(
                provider="groq",
                model=settings.groq_model,
                message="GROQ_API_KEY is required for groq provider",
            )
        self._settings = settings

    @property
    def provider(self) -> str:
        return "groq"

    @property
    def model(self) -> str:
        return self._settings.groq_model

    def build_chat_model(self) -> BaseChatModel:
        return ChatOpenAI(
            model=self._settings.groq_model,
            api_key=self._settings.groq_api_key,
            base_url=self._settings.groq_base_url,
            temperature=0.2,
        )


class GeminiProvider(LlmProvider):
    def __init__(self, settings: Settings) -> None:
        if ChatGoogleGenerativeAI is None:
            raise LlmProviderError(
                provider="gemini",
                model=settings.gemini_model,
                message="langchain_google_genai is not installed",
            )
        if not settings.gemini_api_key:
            raise LlmProviderError(
                provider="gemini",
                model=settings.gemini_model,
                message="GEMINI_API_KEY is required for gemini provider",
            )
        self._settings = settings

    @property
    def provider(self) -> str:
        return "gemini"

    @property
    def model(self) -> str:
        return self._settings.gemini_model

    def build_chat_model(self) -> BaseChatModel:
        return ChatGoogleGenerativeAI(
            model=self._settings.gemini_model,
            google_api_key=self._settings.gemini_api_key,
            temperature=0.2,
        )


def get_llm_provider(settings: Settings) -> LlmProvider:
    name = (settings.llm_provider or "z_ai").strip().lower()
    if name in ("z_ai", "zai", "z.ai"):
        return ZaiProvider(settings)
    if name == "gemini":
        return GeminiProvider(settings)
    if name == "groq":
        return GroqProvider(settings)
    raise LlmProviderError(
        provider=name,
        model="unknown",
        message=f"Unsupported LLM_PROVIDER={settings.llm_provider!r}. Use groq, z_ai, or gemini.",
    )


async def invoke_with_provider_errors(provider: LlmProvider, coro_factory):
    """Run an LLM coroutine; map API failures to LlmProviderError."""
    try:
        return await coro_factory(provider.build_chat_model())
    except LlmProviderError:
        raise
    except Exception as exc:
        raise _extract_api_error(
            exc, provider=provider.provider, model=provider.model
        ) from exc


def get_provider_chain_status() -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    recent = [
        ts
        for ts in _CHAIN_STATUS.get("_failover_timestamps", [])
        if (now - ts).total_seconds() <= 86400
    ]
    _CHAIN_STATUS["_failover_timestamps"] = recent
    _CHAIN_STATUS["total_failovers_24h"] = len(recent)
    return {
        "active_provider": _CHAIN_STATUS["active_provider"],
        "available_providers": list(_CHAIN_STATUS["available_providers"]),
        "last_failover_at": _CHAIN_STATUS["last_failover_at"],
        "total_failovers_24h": _CHAIN_STATUS["total_failovers_24h"],
    }


def _record_active(provider: str) -> None:
    now = datetime.now(timezone.utc)
    _CHAIN_STATUS["active_provider"] = provider
    _CHAIN_STATUS["last_failover_at"] = now.isoformat()
    _CHAIN_STATUS.setdefault("_failover_timestamps", []).append(now)


def _emit_llm_event(cycle_id: str, event_type: EventType, data: Dict[str, Any]) -> None:
    EventStore().emit(cycle_id=cycle_id, event_type=event_type, data=data)


def _provider_for_name(name: str, settings: Settings) -> LlmProvider:
    patched = settings.model_copy(update={"llm_provider": name})
    return get_llm_provider(patched)


def _chain_provider_names(settings: Settings) -> List[str]:
    raw = settings.llm_provider_chain or "groq,z_ai,gemini,local_rules"
    names: List[str] = []
    for part in raw.split(","):
        name = part.strip().lower()
        if name and name != "local_rules" and name not in names:
            names.append(name)
    return names


async def generate_plan(
    observation: ObservationSnapshot,
    settings: Settings,
    allowed_assets: List[str],
    allowed_protocols: List[str],
    lessons: List[str],
    *,
    cycle_id: str = "unknown",
) -> ActionPlan:
    """Ordered provider chain from settings, then local_rules (never raises)."""
    from .llm_reasoner import _run_plan_chain

    for provider_name in _chain_provider_names(settings):
        if _is_circuit_open(provider_name):
            _emit_llm_event(
                cycle_id,
                EventType.LLM_PROVIDER_FAILED,
                {
                    "provider": provider_name,
                    "error_class": "CircuitBreakerOpen",
                    "http_status": 429,
                },
            )
            continue

        started = time.perf_counter()
        try:
            provider = _provider_for_name(provider_name, settings)
        except LlmProviderError as exc:
            _emit_llm_event(
                cycle_id,
                EventType.LLM_PROVIDER_FAILED,
                {
                    "provider": provider_name,
                    "error_class": exc.__class__.__name__,
                    "http_status": exc.status_code,
                },
            )
            continue

        try:

            async def _run(llm):
                return await _run_plan_chain(
                    llm,
                    observation,
                    settings,
                    allowed_assets,
                    allowed_protocols,
                    lessons,
                )

            plan = await invoke_with_provider_errors(provider, _run)
            plan.planner = f"{provider.provider}@{provider.model}"
            _emit_llm_event(
                cycle_id,
                EventType.LLM_PROVIDER_SUCCEEDED,
                {
                    "provider": provider_name,
                    "latency_ms": int((time.perf_counter() - started) * 1000),
                    "prompt_tokens": None,
                    "completion_tokens": None,
                },
            )
            _record_active(provider_name)
            return plan
        except Exception as exc:
            status_code = exc.status_code if isinstance(exc, LlmProviderError) else None
            if status_code == 429:
                _trip_circuit(provider_name)
            _emit_llm_event(
                cycle_id,
                EventType.LLM_PROVIDER_FAILED,
                {
                    "provider": provider_name,
                    "error_class": exc.__class__.__name__,
                    "http_status": status_code,
                },
            )

    plan = build_rules_action_plan(observation, settings, lessons)
    plan.planner = "local_rules@rules@mantis-v1"
    _emit_llm_event(
        cycle_id,
        EventType.LLM_PROVIDER_SUCCEEDED,
        {
            "provider": "local_rules",
            "latency_ms": 0,
            "prompt_tokens": None,
            "completion_tokens": None,
        },
    )
    _record_active("local_rules")
    return plan
