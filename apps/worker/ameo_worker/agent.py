from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Dict

from .graph import build_graph
from .logutil import log_struct
from .sentry_setup import clear_cycle_sentry_context, set_cycle_sentry_context
from .services.event_store import EventStore, EventType
from .state import update_status

logger = logging.getLogger(__name__)


async def run_cycle() -> Dict[str, Any]:
    cycle_id = f"cyc_{uuid.uuid4().hex[:8]}"

    set_cycle_sentry_context(cycle_id)
    log_struct("cycle_start", cycle_id=cycle_id, correlation_id=cycle_id)

    EventStore().emit(
        cycle_id=cycle_id,
        event_type=EventType.CYCLE_STARTED,
        data={"timestamp": datetime.utcnow().isoformat()},
    )

    try:
        graph = build_graph()
        result = await graph.ainvoke({"cycle_id": cycle_id})
        log_struct("cycle_end", cycle_id=cycle_id, correlation_id=cycle_id, ok=True)
        return {**result, "cycle_id": cycle_id}
    except Exception as exc:
        logger.error("Cycle %s failed: %s", cycle_id, exc)
        log_struct(
            "cycle_end",
            cycle_id=cycle_id,
            correlation_id=cycle_id,
            ok=False,
            error=str(exc),
        )
        update_status()
        EventStore().emit(
            cycle_id=cycle_id,
            event_type=EventType.ACTION_FAILED,
            data={"error": str(exc), "critical": True},
        )
        raise
    finally:
        clear_cycle_sentry_context()
