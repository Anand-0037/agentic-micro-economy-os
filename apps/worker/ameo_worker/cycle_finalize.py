from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict

from .context import get_worker_context
from .models import ActionPlan, ExecutionResult, ObservationSnapshot
from .services.event_store import EventStore, EventType
from .services.cycle_store import clear_decision_log_cache
from .services.zero_g_storage import ZeroGAnchorResult
from .logutil import log_struct

logger = logging.getLogger(__name__)


async def finalize_cycle_async(
    *,
    cycle_id: str,
    plan: ActionPlan,
    observation: ObservationSnapshot,
    execution: ExecutionResult,
    violations: list[str],
    byreal_skill_result: Dict[str, Any] | None,
    pnl_value: float,
) -> None:
    """On-chain DecisionLogged — runs off the hot path after cycle returns."""
    ctx = get_worker_context()
    events = EventStore().get_cycle_events(cycle_id)
    trace_payload = {
        "namespace": ctx.settings.zero_g_namespace or "ameo",
        "cycle_id": cycle_id,
        "observation": observation.model_dump(mode="json"),
        "plan": plan.model_dump(mode="json"),
        "execution": execution.model_dump(mode="json"),
        "violations": violations,
        "events": [event.model_dump(mode="json") for event in events],
        "byreal_skill_result": byreal_skill_result,
    }

    anchor = ZeroGAnchorResult(root_hash=None, indexer_url=None, anchored=False)
    if ctx.zero_g.is_configured():
        anchor = await asyncio.to_thread(
            ctx.zero_g.anchor_trace, trace_payload, cycle_id=cycle_id
        )
        if anchor.anchored and anchor.root_hash:
            EventStore().emit(
                cycle_id=cycle_id,
                event_type=EventType.ZERO_G_ANCHOR_SUCCEEDED,
                data={"root_hash": anchor.root_hash, "indexer_url": anchor.indexer_url},
            )
        else:
            EventStore().emit(
                cycle_id=cycle_id,
                event_type=EventType.ZERO_G_ANCHOR_FAILED,
                data={"reason": "anchor_failed"},
            )

    if ctx.onchain is None or plan.action_type == "no_op":
        return

    blocked = execution.command == "guardrail_blocked" or (
        not execution.ok and bool(violations)
    )
    if not execution.ok and not blocked:
        return

    if blocked:
        action_type = "policy_blocked"
        rationale_text = (
            f"Policy blocked: {', '.join(violations)}. "
            f"{plan.rationale_summary or plan.rationale or ''}"
        ).strip()
    else:
        if execution.command == "treasury_ping":
            action_type = "treasury_ping"
        else:
            action_type = plan.action_type
        rationale_text = plan.rationale or plan.rationale_summary or "no_rationale"

    metadata_uri = (
        anchor.root_hash
        if anchor.anchored and anchor.root_hash
        else f"ameo://cycle/{cycle_id}"
    )
    data_hash = anchor.root_hash or metadata_uri

    try:
        pnl1e18 = int(round(pnl_value * 1e18))
        log_result = await asyncio.to_thread(
            ctx.onchain.log_decision,
            ctx.settings.agent_token_id,
            rationale_text,
            pnl1e18,
            action_type,
            metadata_uri,
            data_hash,
        )
        onchain_tx = log_result.get("tx_hash") if isinstance(log_result, dict) else None
        log_struct(
            "onchain_decision_logged",
            cycle_id=cycle_id,
            tx_hash=onchain_tx,
            action_type=action_type,
        )
        if onchain_tx:
            EventStore().emit(
                cycle_id=cycle_id,
                event_type=EventType.ONCHAIN_DECISION_LOGGED,
                data={
                    "tx_hash": onchain_tx,
                    "action_type": action_type,
                    "rationale_uri": metadata_uri,
                },
            )
            clear_decision_log_cache()
    except Exception as exc:
        logger.warning("onchain_log_failed cycle=%s error=%s", cycle_id, exc)
