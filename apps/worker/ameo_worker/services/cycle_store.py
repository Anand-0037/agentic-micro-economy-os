from __future__ import annotations

from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from ..models import CycleDetail, CycleSummary, PolicyCheck
from ..policy import serialize_default_policy
from ..settings import Settings, get_settings
from .decision_logs import fetch_decision_logs
from .event_store import AgentEvent, EventType

_EVENTS_DIR = Path(__file__).resolve().parents[2] / "logs" / "events"

_STANDARD_RULES: tuple[tuple[str, str], ...] = (
    ("max_drawdown", "drawdown_exceeded"),
    ("max_position", "max_position_exceeded"),
    ("asset_whitelist", "asset_in_not_allowed"),
    ("asset_whitelist", "asset_out_not_allowed"),
    ("protocol_whitelist", "protocol_not_allowed"),
    ("observation_quality", "degraded_observation_quality"),
    ("balance_sufficiency", "insufficient_balance"),
    ("gas_price_guard", "gas_price_spike_blocked"),
)


def _events_dir(settings: Optional[Settings] = None) -> Path:
    _ = settings
    return _EVENTS_DIR


def _iter_log_files(log_dir: Path) -> List[Path]:
    if not log_dir.is_dir():
        return []
    return sorted(log_dir.glob("events_*.jsonl"))


def _load_all_events(log_dir: Path) -> List[AgentEvent]:
    events: List[AgentEvent] = []
    for path in _iter_log_files(log_dir):
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    events.append(AgentEvent.parse_raw(line))
                except Exception:
                    continue
    events.sort(key=lambda event: event.timestamp)
    return events


def _group_by_cycle(events: List[AgentEvent]) -> Dict[str, List[AgentEvent]]:
    grouped: Dict[str, List[AgentEvent]] = {}
    for event in events:
        grouped.setdefault(event.cycle_id, []).append(event)
    for cycle_events in grouped.values():
        cycle_events.sort(key=lambda item: item.timestamp)
    return grouped


def _first_event(
    events: List[AgentEvent], event_type: EventType
) -> Optional[AgentEvent]:
    for event in events:
        if event.event_type == event_type:
            return event
    return None


def _last_event(
    events: List[AgentEvent], event_type: EventType
) -> Optional[AgentEvent]:
    matched = [event for event in events if event.event_type == event_type]
    return matched[-1] if matched else None


def _normalize_tx_hash(value: Optional[str]) -> str:
    if not value:
        return ""
    text = str(value).strip().lower()
    if text.startswith("0x"):
        return text
    return f"0x{text}"


def _explorer_tx_url(settings: Settings, tx_hash: str) -> str:
    if not tx_hash:
        return ""
    netloc = urlparse(settings.mantle_rpc_url).netloc or ""
    if settings.mantle_chain_id == 5003 or "sepolia" in netloc:
        base = "https://sepolia.mantlescan.xyz"
    else:
        base = "https://mantlescan.xyz"
    return f"{base}/tx/{_normalize_tx_hash(tx_hash)}"


def _agent_eoa(settings: Settings) -> str:
    if not settings.agent_private_key:
        return settings.treasury_eoa or ""
    try:
        from ..clients.mantle import MantleClient

        mantle = MantleClient(settings)
        return mantle.w3.eth.account.from_key(settings.agent_private_key).address
    except Exception:
        return settings.treasury_eoa or ""


def _build_policy_checks(violations: List[str]) -> List[PolicyCheck]:
    violation_set = set(violations)
    checks: List[PolicyCheck] = []
    seen_rules: set[str] = set()

    for rule, violation_key in _STANDARD_RULES:
        if rule in seen_rules:
            continue
        matched = [item for item in violations if item == violation_key or item.startswith(f"{violation_key}:")]
        if matched:
            checks.append(
                PolicyCheck(
                    rule=rule,
                    passed=False,
                    reason=matched[0],
                )
            )
            seen_rules.add(rule)
        else:
            checks.append(PolicyCheck(rule=rule, passed=True, reason="PASS"))
            seen_rules.add(rule)

    for violation in violation_set:
        if any(violation == key or violation.startswith(f"{key}:") for _, key in _STANDARD_RULES):
            continue
        checks.append(
            PolicyCheck(rule="custom_guardrail", passed=False, reason=violation)
        )

    if not checks:
        checks.append(PolicyCheck(rule="guardrail_evaluated", passed=True, reason="PASS"))

    return checks


def _derive_status(events: List[AgentEvent]) -> str:
    completed = _last_event(events, EventType.CYCLE_COMPLETED)
    executed = _last_event(events, EventType.ACTION_EXECUTED)
    failed = _last_event(events, EventType.ACTION_FAILED)

    if failed and not (executed and executed.timestamp > failed.timestamp):
        return "failed"
    if completed:
        ok = bool(completed.data.get("ok", True))
        return "verified" if ok else "failed"
    if executed:
        return "executed"
    return "in_progress"


@lru_cache(maxsize=1)
def _decision_log_index() -> Dict[str, Dict[str, Any]]:
    settings = get_settings()
    index: Dict[str, Dict[str, Any]] = {}
    try:
        for entry in fetch_decision_logs(settings):
            tx_hash = _normalize_tx_hash(entry.get("txHash"))
            if tx_hash:
                index[tx_hash] = entry
    except Exception:
        pass
    return index


def _build_summary(
    cycle_id: str,
    events: List[AgentEvent],
    settings: Settings,
    decision_index: Dict[str, Dict[str, Any]],
) -> CycleSummary:
    started = _first_event(events, EventType.CYCLE_STARTED)
    completed = _last_event(events, EventType.CYCLE_COMPLETED)
    plan = _first_event(events, EventType.PLAN_GENERATED)
    executed = _last_event(events, EventType.ACTION_EXECUTED)
    failed = _last_event(events, EventType.ACTION_FAILED)

    tx_hash: Optional[str] = None
    if executed and executed.data.get("tx_hash"):
        tx_hash = str(executed.data["tx_hash"])
    elif failed and failed.data.get("tx_hash"):
        tx_hash = str(failed.data["tx_hash"])

    pnl_1e18: Optional[str] = None
    has_zero_g = False
    if tx_hash:
        decision = decision_index.get(_normalize_tx_hash(tx_hash))
        if decision:
            pnl_1e18 = decision.get("pnl1e18")
            has_zero_g = bool(decision.get("dataHash"))

    action_type = "unknown"
    if plan:
        action_type = str(plan.data.get("action_type") or "unknown")

    return CycleSummary(
        cycle_id=cycle_id,
        started_at=started.timestamp if started else events[0].timestamp,
        ended_at=completed.timestamp if completed else None,
        action_type=action_type,
        status=_derive_status(events),
        tx_hash=tx_hash,
        pnl_1e18=pnl_1e18,
        has_zero_g_receipt=has_zero_g,
    )


def _build_detail(
    cycle_id: str,
    events: List[AgentEvent],
    settings: Settings,
    decision_index: Dict[str, Dict[str, Any]],
) -> CycleDetail:
    summary = _build_summary(cycle_id, events, settings, decision_index)
    observation_event = _first_event(events, EventType.OBSERVATION_COMPLETED)
    plan_event = _first_event(events, EventType.PLAN_GENERATED)
    guardrail_event = _first_event(events, EventType.GUARDRAIL_EVALUATED)
    executed = _last_event(events, EventType.ACTION_EXECUTED)
    failed = _last_event(events, EventType.ACTION_FAILED)

    obs_data = observation_event.data if observation_event else {}
    rpc_netloc = urlparse(settings.mantle_rpc_url).netloc or settings.mantle_rpc_url

    observation: Dict[str, Any] = {
        "balances": obs_data.get("balances", {}),
        "gas_price_wei": obs_data.get("gas_price_wei"),
        "block_number": obs_data.get("block_number"),
        "rpc_url": settings.mantle_rpc_url,
        "rpc_netloc": rpc_netloc,
        "observation_quality": obs_data.get("quality", obs_data.get("observation_quality")),
        "sources": obs_data.get("sources", []),
        "errors": obs_data.get("errors", []),
    }

    treasury: Dict[str, Any] = {
        "treasury_eoa": settings.treasury_eoa,
        "agent_eoa": _agent_eoa(settings),
        "deployable_window_usd": settings.max_position_usd,
        "max_daily_volume_usd": settings.max_daily_volume_usd,
    }

    market_signal: Dict[str, Any] = {
        "sources": obs_data.get("sources", []),
        "note": "Market tickers captured at observe time; persisted via worker status between cycles.",
    }

    plan: Dict[str, Any] = {}
    if plan_event:
        plan = {
            "planner_version": plan_event.data.get("planner"),
            "action_type": plan_event.data.get("action_type"),
            "protocol": plan_event.data.get("protocol"),
            "rationale": plan_event.data.get("rationale"),
            "correlation_id": plan_event.correlation_id,
            "plan": plan_event.data,
        }

    violations = list(guardrail_event.data.get("violations", [])) if guardrail_event else []
    policy_checks = _build_policy_checks(violations)

    execution_event = executed or failed
    tx_hash = summary.tx_hash
    execution: Dict[str, Any] = {
        "ok": execution_event.data.get("ok") if execution_event else None,
        "target_contract": settings.merchant_moe_router or settings.fusionx_v2_router,
        "method": plan_event.data.get("action_type") if plan_event else None,
        "protocol": plan_event.data.get("protocol") if plan_event else None,
        "slippage_bps": settings.dex_slippage_bps,
        "calldata": execution_event.data if execution_event else {},
        "error": execution_event.data.get("error") if execution_event else None,
    }

    decision_log: Optional[Dict[str, Any]] = None
    zero_g: Optional[Dict[str, Any]] = None
    if tx_hash:
        matched = decision_index.get(_normalize_tx_hash(tx_hash))
        if matched:
            decision_log = {
                **matched,
                "verify_url": _explorer_tx_url(settings, tx_hash),
                "identity_address": settings.agent_identity_address,
            }
            data_hash = matched.get("dataHash") or ""
            if data_hash:
                indexer = settings.zero_g_indexer_url or ""
                zero_g = {
                    "root_hash": data_hash,
                    "indexer_url": indexer,
                    "content_type": "application/json",
                    "size_bytes": None,
                }

    policy_snapshot = serialize_default_policy(settings)

    return CycleDetail(
        summary=summary,
        observation=observation,
        treasury=treasury,
        market_signal=market_signal,
        plan=plan,
        policy_checks=policy_checks,
        policy_snapshot=policy_snapshot,
        execution=execution,
        tx_hash={
            "hash": tx_hash,
            "explorer_url": _explorer_tx_url(settings, tx_hash) if tx_hash else None,
        },
        decision_log=decision_log,
        zero_g=zero_g,
    )


def list_cycles(limit: int = 50, offset: int = 0) -> tuple[List[CycleSummary], int]:
    settings = get_settings()
    log_dir = _events_dir(settings)
    grouped = _group_by_cycle(_load_all_events(log_dir))
    decision_index = _decision_log_index()

    summaries = [
        _build_summary(cycle_id, events, settings, decision_index)
        for cycle_id, events in grouped.items()
    ]
    summaries.sort(key=lambda item: item.started_at, reverse=True)
    total = len(summaries)
    page = summaries[offset : offset + limit]
    return page, total


def get_cycle(cycle_id: str) -> Optional[CycleDetail]:
    settings = get_settings()
    log_dir = _events_dir(settings)
    grouped = _group_by_cycle(_load_all_events(log_dir))
    events = grouped.get(cycle_id)
    if not events:
        return None
    decision_index = _decision_log_index()
    return _build_detail(cycle_id, events, settings, decision_index)


def clear_cycle_cache() -> None:
    _decision_log_index.cache_clear()
