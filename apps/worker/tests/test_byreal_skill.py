from __future__ import annotations

import ast
from unittest.mock import patch

import httpx
import pytest

from ameo_worker.services.byreal_skill import ByrealSkillError, invoke_skill


def test_byreal_skill_is_telemetry_only_no_subprocess():
    """CI guard against Block H zombie: byreal_skill.py must never shell out to byreal-cli."""
    import os
    here = os.path.dirname(__file__)
    target = os.path.join(here, "..", "ameo_worker", "services", "byreal_skill.py")
    with open(os.path.abspath(target), "r") as f:
        source = f.read()
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                assert "subprocess" not in alias.name, "subprocess import found in byreal_skill.py"
        if isinstance(node, ast.ImportFrom):
            assert node.module != "subprocess", "subprocess import found in byreal_skill.py"


def test_invoke_skill_success(caplog: pytest.LogCaptureFixture) -> None:
    """Pure HTTP quote path (telemetry only)."""
    mock_response = httpx.Response(
        200,
        json={"quoteId": "q1", "outAmount": "1000", "slippageBps": 12},
    )

    with caplog.at_level("INFO", logger="ameo.byreal"):
        with patch("httpx.Client.post", return_value=mock_response):
            result = invoke_skill(
                "mantle.swap.v1",
                {"from_token": "MNT", "to_token": "WMNT", "amount_usd": 1.0},
            )

    assert result.exit_code == 0
    assert result.stdout["quoteId"] == "q1"
    assert result.dry_run is True
    assert result.latency_ms >= 0
    assert any("byreal_quote_fetched skill=mantle.swap.v1" in rec.message for rec in caplog.records)


def test_invoke_skill_http_error() -> None:
    mock_response = httpx.Response(429, text="rate limited")

    with patch("httpx.Client.post", return_value=mock_response):
        with pytest.raises(ByrealSkillError) as exc_info:
            invoke_skill("mantle.swap.v1", {"from_token": "MNT", "to_token": "WMNT", "amount_usd": 1})

    assert exc_info.value.exit_code == 429
    assert "rate limited" in exc_info.value.stderr


def test_invoke_skill_timeout() -> None:
    with patch("httpx.Client.post", side_effect=httpx.TimeoutException("timeout")):
        with pytest.raises(ByrealSkillError) as exc_info:
            invoke_skill("mantle.swap.v1", {"from_token": "MNT", "to_token": "WMNT", "amount_usd": 1})

    msg = str(exc_info.value).lower()
    assert "quote failed" in msg or "timed out" in msg
