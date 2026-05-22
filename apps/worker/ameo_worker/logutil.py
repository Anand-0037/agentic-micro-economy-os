"""Structured JSON lines for operator grep and observability (PRD observability)."""

from __future__ import annotations

import json
import logging
from typing import Any, Mapping

_log = logging.getLogger("ameo.structured")


def log_struct(event: str, **fields: Any) -> None:
    """Emit one JSON object per line with a stable `event` discriminator."""
    payload: Mapping[str, Any] = {"event": event, **fields}
    _log.info(json.dumps(payload, default=str))
