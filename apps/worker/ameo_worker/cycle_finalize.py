from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict

from .context import get_worker_context
from .models import ActionPlan, ExecutionResult, ObservationSnapshot
from .services.event_store import EventStore, EventType
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
    """0G anchor + on-chain DecisionLogged — runs off the hot path after cycle returns."""
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

    anchor = await asyncio.to_thread(
        ctx.zero_g.anchor_trace, trace_payload, cycle_id=cycle_id
    )
    zero_g_data_hash: str | None = None

    if anchor.anchored and anchor.root_hash:
        zero_g_data_hash = anchor.root_hash
        EventStore().emit(
            cycle_id=cycle_id,
            event_type=EventType.ZERO_G_ANCHOR_SUCCEEDED,
            data={"root_hash": anchor.root_hash, "indexer_url": anchor.indexer_url},
        )
    elif ctx.zero_g.is_configured():
        EventStore().emit(
            cycle_id=cycle_id,
            event_type=EventType.ZERO_G_ANCHOR_FAILED,
            data={"reason": "anchor_failed"},
        )

    if (
        execution.ok
        and plan.action_type != "no_op"
        and ctx.onchain is not None
    ):
        rationale_text = plan.rationale or plan.rationale_summary or "no_rationale"
        metadata_uri = anchor.root_hash if anchor.anchored and anchor.root_hash else ""
        try:
            pnl1e18 = int(round(pnl_value * 1e18))
            log_result = await asyncio.to_thread(
                ctx.onchain.log_decision,
                ctx.settings.agent_token_id,
                rationale_text,
                pnl1e18,
                plan.action_type,
                metadata_uri,
                zero_g_data_hash or "",
            )
            log_struct(
                "onchain_decision_logged",
                cycle_id=cycle_id,
                tx_hash=log_result.get("tx_hash") if isinstance(log_result, dict) else None,
            )
        except Exception as exc:
            logger.warning("onchain_log_failed cycle=%s error=%s", cycle_id, exc)
