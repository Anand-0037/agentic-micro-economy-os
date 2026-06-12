from __future__ import annotations

import asyncio
import hashlib
import json
import random
from typing import Any, Dict, List, TypedDict

from langgraph.graph import END, StateGraph

from .adapters.mantle_dex import MantleDexAdapter
from .clients.mantle import MantleClient
from .clients.signals import SignalClient
from .context import get_worker_context
from .cycle_finalize import finalize_cycle_async
from .models import ActionPlan, ExecutionResult, ObservationSnapshot
from .policy import PolicyEngine, policy_config_from_settings
from .settings import get_settings
from .state import update_status
from .services.delta_neutral_planner import build_delta_neutral_plan
from .services.llm_reasoner import reason_action_plan
from .services.llm_provider import LlmProviderError
from .services.rules_planner import build_rules_action_plan
from .services.guardrail_service import GuardrailService
from .services.byreal_skill import ByrealSkillError, invoke_skill
from .services.event_store import EventStore, EventType
from .logutil import log_struct


class AgentState(TypedDict, total=False):
    observation: ObservationSnapshot
    plan: ActionPlan
    guardrail_ok: bool
    violations: List[str]
    execution: ExecutionResult
    log: Dict[str, Any]
    retry_count: int
    cycle_id: str
    byreal_skill_result: Dict[str, Any] | None
    zero_g: Dict[str, Any] | None


def _ctx():
    return get_worker_context()


def _plan_hash(plan: ActionPlan) -> str:
    payload = plan.model_dump(mode="json", exclude={"created_at"})
    canonical = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


async def observe(state: AgentState) -> AgentState:
    settings = get_settings()
    mantle = MantleClient(settings)
    signals = SignalClient(settings)

    observation = ObservationSnapshot()
    errors: List[str] = []

    execution_eoa = settings.treasury_eoa
    if settings.agent_private_key:
        try:
            execution_eoa = mantle.w3.eth.account.from_key(
                settings.agent_private_key
            ).address
        except Exception as exc:
            errors.append("agent_key_invalid")
            log_struct("observe_key_error", error=str(exc))

    if not execution_eoa:
        errors.append("execution_eoa_missing")
        observation.observation_quality = 0.0
    else:
        try:
            tokens = ["MNT"]
            if settings.mantle_usdc_address:
                tokens.append("USDC")
            if settings.mantle_wmnt_address:
                tokens.append("WMNT")
            balances, quality = mantle.get_balances(
                execution_eoa,
                tokens,
            )
            observation.balances = balances
            observation.observation_quality = quality
            observation.gas_price_wei = mantle.get_gas_price()
            observation.sources.append("mantle")
            observation.macro_signals["execution_eoa"] = execution_eoa
            if (
                settings.treasury_eoa
                and settings.treasury_eoa.lower() != execution_eoa.lower()
            ):
                treasury_balances, _ = mantle.get_balances(
                    settings.treasury_eoa, ["MNT"]
                )
                observation.macro_signals["treasury_balances"] = treasury_balances
                observation.macro_signals["treasury_eoa"] = settings.treasury_eoa
        except Exception as exc:
            log_struct(
                "mantle_rpc_error",
                cycle_id=state.get("cycle_id", "unknown"),
                error=str(exc),
            )
            errors.append("mantle_rpc_error")
            observation.observation_quality = 0.0

    if settings.bybit_api_key and settings.bybit_api_secret:
        try:
            market_context = await signals.get_market_context()
            observation.macro_signals = market_context
            observation.sources.append("bybit")
            tickers = market_context.get("tickers", {})
            for symbol, data in tickers.items():
                if isinstance(data, dict) and "last_price" in data:
                    observation.prices[symbol] = data["last_price"]
            # Normalize MNT price change for volatility planner (real signals for organic triggers)
            mnt_ticker = tickers.get("MNTUSDT", {}) if isinstance(tickers, dict) else {}
            if isinstance(mnt_ticker, dict):
                observation.macro_signals["mnt_price_change_pct"] = mnt_ticker.get("price_change_pct", 0)
        except Exception:
            errors.append("bybit_signal_error")

    if errors:
        observation.macro_signals = {**observation.macro_signals, "errors": errors}

    cycle_id = state.get("cycle_id", "unknown")
    block_number: int | None = None
    try:
        block_number = mantle.w3.eth.block_number
    except Exception:
        pass

    log_struct(
        "observe_complete",
        cycle_id=cycle_id,
        correlation_id=cycle_id,
        quality=observation.observation_quality,
        errors=errors,
    )

    # Emit event
    EventStore().emit(
        cycle_id=cycle_id,
        event_type=EventType.OBSERVATION_COMPLETED,
        data={
            "quality": observation.observation_quality,
            "sources": observation.sources,
            "balances": observation.balances,
            "gas_price_wei": observation.gas_price_wei,
            "block_number": block_number,
            "errors": errors,
        },
    )

    return {"observation": observation, **state}


async def reason(state: AgentState) -> AgentState:
    if "observation" not in state:
        return state
    if "plan" in state:
        return state

    settings = get_settings()
    pc = policy_config_from_settings(settings)
    lessons = _ctx().memory.recent_failures(limit=5)
    cycle_id = state.get("cycle_id", "unknown")
    try:
        plan = await reason_action_plan(
            state["observation"],
            settings,
            list(pc.allowed_assets),
            list(pc.allowed_protocols),
            lessons,
            cycle_id=cycle_id,
        )
    except LlmProviderError as exc:
        log_struct(
            "reason_llm_degraded",
            cycle_id=state.get("cycle_id", "unknown"),
            error=str(exc),
            provider=getattr(exc, "provider", "unknown"),
        )
        plan = build_rules_action_plan(state["observation"], settings, lessons)
    except Exception as exc:
        log_struct(
            "reason_failed",
            cycle_id=state.get("cycle_id", "unknown"),
            error=str(exc),
        )
        raise

    # Inject cycle_id into plan
    cycle_id = state.get("cycle_id", "unknown")
    plan.cycle_id = cycle_id

    # Emit event
    EventStore().emit(
        cycle_id=cycle_id,
        event_type=EventType.PLAN_GENERATED,
        data={
            "action_type": plan.action_type,
            "protocol": plan.protocol,
            "rationale": plan.rationale_summary,
            "planner": plan.planner,
        },
        correlation_id=plan.correlation_id,
    )

    return {"plan": plan, **state}


def plan(state: AgentState) -> AgentState:
    action_plan = state.get("plan")
    if not action_plan:
        raise RuntimeError("missing_plan_after_reason")

    cycle_id = state.get("cycle_id", "unknown")
    byreal_skill_result: Dict[str, Any] | None = None

    if action_plan.action_type == "swap":
        amount_usd = float(
            action_plan.size_usd
            if action_plan.size_usd is not None
            else action_plan.action_params.get("amount")
            or 0
        )
        params = {
            "from_token": action_plan.asset_in or "MNT",
            "to_token": action_plan.asset_out or "WMNT",
            "amount_usd": amount_usd,
        }
        try:
            skill_result = invoke_skill("mantle.swap.v1", params)
            byreal_skill_result = {
                "stdout": skill_result.stdout,
                "stderr": skill_result.stderr,
                "exit_code": skill_result.exit_code,
                "latency_ms": skill_result.latency_ms,
                "dry_run": skill_result.dry_run,
            }
        except ByrealSkillError as exc:
            log_struct(
                "byreal_skill_error",
                cycle_id=cycle_id,
                error=str(exc),
                stderr=exc.stderr,
                exit_code=exc.exit_code,
            )
            byreal_skill_result = None

        EventStore().emit(
            cycle_id=cycle_id,
            event_type=EventType.BYREAL_SKILL_INVOKED,
            data={
                "skill": "mantle.swap.v1",
                "byreal_skill_result": byreal_skill_result,
                "params": params,
            },
            correlation_id=action_plan.correlation_id,
        )

    return {"plan": action_plan, "byreal_skill_result": byreal_skill_result, **state}


def delta_neutral(state: AgentState) -> AgentState:
    observation = state.get("observation")
    if not observation:
        return state
    plan = build_delta_neutral_plan(observation, get_settings())
    if not plan:
        return state
    return {"plan": plan, **state}


def guardrail(state: AgentState) -> AgentState:
    observation = state.get("observation")
    plan = state.get("plan")
    if not observation or not plan:
        return {"guardrail_ok": False, "violations": ["missing_input"], **state}

    pc = policy_config_from_settings(get_settings())

    # Initialize Guardrail Service
    service = GuardrailService(pc)

    # Check plan
    guardrail_ok, violations = service.check_plan(plan, observation)

    # Delta-neutral now active (see delta_neutral_planner.py + adapter lp/perp support).
    # engine = PolicyEngine(pc)
    # hedge_drift = observation.macro_signals.get("hedge_drift_pct")
    # if engine.should_force_rebalance(hedge_drift):
    #     forced_plan = build_delta_neutral_plan(observation, get_settings())
    #     if forced_plan:
    #         ...  # could override plan here for forced rebalance


    # Emit event
    cycle_id = state.get("cycle_id", "unknown")
    EventStore().emit(
        cycle_id=cycle_id,
        event_type=EventType.GUARDRAIL_EVALUATED,
        data={
            "ok": guardrail_ok,
            "violations": violations,
            "action_type": plan.action_type,
        },
        correlation_id=plan.correlation_id,
    )

    return {
        "guardrail_ok": guardrail_ok,
        "violations": violations,
        "plan": plan,
        **state,
    }


def act(state: AgentState) -> AgentState:
    cycle_id = state.get("cycle_id", "unknown")

    if not state.get("guardrail_ok"):
        execution = ExecutionResult(
            ok=False,
            command="guardrail_blocked",
            dry_run=True,
            error="guardrail_blocked",
            cycle_id=cycle_id,
        )
        return {"execution": execution, **state}

    if state["plan"].action_type == "no_op":
        execution = ExecutionResult(
            ok=True,
            command="no_op",
            dry_run=True,
            raw_output={"status": "no_op"},
            cycle_id=cycle_id,
        )
        return {"execution": execution, **state}

    settings = get_settings()
    plan = state["plan"]
    notional = float(
        plan.size_usd if plan.size_usd is not None else plan.action_params.get("amount") or 0
    )

    from .identity_status import effective_max_daily_volume_usd

    daily_cap = effective_max_daily_volume_usd(settings)
    if daily_cap > 0 and notional > 0:
        used = _ctx().memory.daily_notional_today()
        if used + notional > daily_cap:
            log_struct(
                "act_blocked",
                cycle_id=cycle_id,
                correlation_id=plan.correlation_id,
                reason="daily_volume_cap",
                used_usd=used,
                plan_usd=notional,
                cap=daily_cap,
            )
            execution = ExecutionResult(
                ok=False,
                command="daily_volume_cap",
                dry_run=True,
                error="daily_volume_cap_exceeded",
                cycle_id=cycle_id,
            )
            return {"execution": execution, **state}

    if not settings.allows_live_execution():
        log_struct(
            "act_skipped_live",
            cycle_id=cycle_id,
            correlation_id=plan.correlation_id,
            live_enabled=settings.live_enabled,
            worker_mode=settings.worker_mode,
            execution_adapter=settings.execution_adapter,
        )
        execution = ExecutionResult(
            ok=False,
            command="live_execution_not_permitted",
            dry_run=False,
            error="live_execution_not_permitted",
            raw_output={
                "live_enabled": settings.live_enabled,
                "worker_mode": settings.worker_mode,
                "execution_adapter": settings.execution_adapter,
            },
            cycle_id=cycle_id,
        )
        return {"execution": execution, **state}

    plan_hash = _plan_hash(plan)
    if _ctx().memory.plan_executed_recently(plan_hash, within_minutes=5):
        log_struct(
            "act_idempotent_skip",
            cycle_id=cycle_id,
            correlation_id=plan.correlation_id,
            plan_hash=plan_hash,
        )
        execution = ExecutionResult(
            ok=True,
            command="idempotent_skip",
            dry_run=True,
            error=None,
            raw_output={"plan_hash": plan_hash, "reason": "duplicate_plan_within_5m"},
            cycle_id=cycle_id,
        )
        return {"execution": execution, **state}

    adapter = MantleDexAdapter(settings)
    execution = adapter.execute_from_plan(state["plan"])
    execution.cycle_id = cycle_id

    if execution.ok and not execution.dry_run and notional > 0:
        _ctx().memory.add_notional_usd(notional)
        _ctx().memory.record_plan_execution(plan_hash, cycle_id)

    log_struct(
        "act_executed",
        cycle_id=cycle_id,
        correlation_id=plan.correlation_id,
        ok=execution.ok,
        dry_run=execution.dry_run,
        command=execution.command,
        error=execution.error,
    )

    # Emit event
    EventStore().emit(
        cycle_id=cycle_id,
        event_type=(
            EventType.ACTION_EXECUTED if execution.ok else EventType.ACTION_FAILED
        ),
        data={
            "ok": execution.ok,
            "tx_hash": execution.tx_hash,
            "error": execution.error,
            "command": execution.command,
        },
        correlation_id=state["plan"].correlation_id,
    )

    return {"execution": execution, **state}


async def self_heal(state: AgentState) -> AgentState:
    execution = state.get("execution")
    plan = state.get("plan")
    if not execution or not plan:
        return state
    if execution.ok or execution.dry_run or execution.command == "no_op":
        return state

    retryable = False
    error_text = (execution.error or "").lower()
    if (
        "timeout" in error_text
        or "rpc" in error_text
        or "execution_failed" in error_text
    ):
        retryable = True

    if not retryable:
        _ctx().memory.record_learning(
            f"Critical failure: {plan.action_type} error={execution.error}"
        )
        return state

    settings = get_settings()
    adapter = MantleDexAdapter(settings)
    for attempt in range(1, 4):
        backoff = (2 ** (attempt - 1)) + random.uniform(0, 0.5)
        await asyncio.sleep(backoff)
        retry_execution = adapter.execute_from_plan(plan)
        if retry_execution.ok:
            return {"execution": retry_execution, "retry_count": attempt, **state}

    _ctx().memory.record_learning(
        f"Critical failure after retries: {plan.action_type} error={execution.error}"
    )
    return state


def log(state: AgentState) -> AgentState:
    log_payload: Dict[str, Any] = {"status": "ok"}
    execution = state.get("execution")
    plan = state.get("plan")
    observation = state.get("observation")
    cycle_id = state.get("cycle_id", "unknown")
    pnl_value = 0.0

    if plan and observation and execution:
        if isinstance(execution.raw_output, dict):
            pnl_value = float(execution.raw_output.get("pnl", 0) or 0)
        _ctx().memory.record_execution(
            plan, observation, pnl_value, "ok" if execution.ok else "error"
        )
        if pnl_value < 0:
            _ctx().memory.record_learning(
                f"{plan.action_type} produced negative pnl {pnl_value}"
            )

        log_payload["zero_g"] = {"status": "pending", "reason": "background_anchor"}
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(
                finalize_cycle_async(
                    cycle_id=cycle_id,
                    plan=plan,
                    observation=observation,
                    execution=execution,
                    violations=state.get("violations", []),
                    byreal_skill_result=state.get("byreal_skill_result"),
                    pnl_value=pnl_value,
                )
            )
        except RuntimeError:
            asyncio.run(
                finalize_cycle_async(
                    cycle_id=cycle_id,
                    plan=plan,
                    observation=observation,
                    execution=execution,
                    violations=state.get("violations", []),
                    byreal_skill_result=state.get("byreal_skill_result"),
                    pnl_value=pnl_value,
                )
            )

    update_status(state.get("observation"), state.get("execution"))

    EventStore().emit(
        cycle_id=cycle_id,
        event_type=EventType.CYCLE_COMPLETED,
        data={
            "ok": execution.ok if execution else True,
            "violations": state.get("violations", []),
        },
    )

    return {"log": log_payload, "zero_g": state.get("zero_g"), **state}


def build_graph() -> Any:
    graph = StateGraph(AgentState)
    graph.add_node("observe", observe)
    graph.add_node("delta_neutral", delta_neutral)
    graph.add_node("reason", reason)
    graph.add_node("plan", plan)
    graph.add_node("guardrail", guardrail)
    graph.add_node("act", act)
    graph.add_node("self_heal", self_heal)
    graph.add_node("log", log)

    graph.set_entry_point("observe")
    graph.add_edge("observe", "delta_neutral")
    graph.add_edge("delta_neutral", "reason")
    graph.add_edge("reason", "plan")
    graph.add_edge("plan", "guardrail")
    graph.add_edge("guardrail", "act")
    graph.add_edge("act", "self_heal")
    graph.add_edge("self_heal", "log")
    graph.add_edge("log", END)

    return graph.compile()
