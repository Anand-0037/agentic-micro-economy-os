from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional

from .models import ExecutionResult, ObservationSnapshot


@dataclass
class StatusSnapshot:
    observation: Optional[ObservationSnapshot] = None
    last_execution: Optional[ExecutionResult] = None
    updated_at: Optional[datetime] = None


_STATUS = StatusSnapshot()


def update_status(
    observation: Optional[ObservationSnapshot] = None,
    execution: Optional[ExecutionResult] = None,
) -> None:
    if observation is not None:
        _STATUS.observation = observation
    if execution is not None:
        _STATUS.last_execution = execution
    _STATUS.updated_at = datetime.utcnow()


def get_status() -> Dict[str, Any]:
    return {
        "updated_at": _STATUS.updated_at.isoformat() if _STATUS.updated_at else None,
        "observation": (
            _STATUS.observation.model_dump() if _STATUS.observation else None
        ),
        "last_execution": (
            _STATUS.last_execution.model_dump() if _STATUS.last_execution else None
        ),
    }
