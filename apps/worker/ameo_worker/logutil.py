"""Structured JSON lines for operator grep and observability (PRD observability)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Mapping

_log = logging.getLogger("ameo.structured")

_SENSITIVE_KEY_PATTERN = re.compile(
    r"(private[_-]?key|secret|api[_-]?key|password|token|authorization|dsn)",
    re.IGNORECASE,
)
_HEX_PRIVATE_KEY = re.compile(r"^0x[0-9a-fA-F]{64}$")


def _scrub_value(key: str, value: Any) -> Any:
    if isinstance(value, dict):
        return scrub_secrets(value)
    if isinstance(value, list):
        return [_scrub_value(key, item) for item in value]
    if _SENSITIVE_KEY_PATTERN.search(key):
        return "***"
    if isinstance(value, str):
        if _HEX_PRIVATE_KEY.match(value.strip()):
            return "***"
        if "gsk_" in value or value.startswith("sk-"):
            return "***"
    return value


def scrub_secrets(payload: Mapping[str, Any]) -> dict[str, Any]:
    return {key: _scrub_value(key, value) for key, value in payload.items()}


def log_struct(event: str, **fields: Any) -> None:
    """Emit one JSON object per line with a stable `event` discriminator."""
    payload: Mapping[str, Any] = scrub_secrets({"event": event, **fields})
    _log.info(json.dumps(payload, default=str))
