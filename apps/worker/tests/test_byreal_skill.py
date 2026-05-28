from __future__ import annotations

import subprocess
from unittest.mock import MagicMock, patch

import pytest

from ameo_worker.services.byreal_skill import ByrealSkillError, invoke_skill


def test_invoke_skill_success(caplog: pytest.LogCaptureFixture) -> None:
    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_result.stdout = '{"quoteId":"q1","outAmount":"1000"}'
    mock_result.stderr = ""

    with caplog.at_level("INFO", logger="ameo.byreal"):
        with patch("ameo_worker.services.byreal_skill.subprocess.run", return_value=mock_result):
            result = invoke_skill(
                "mantle.swap.v1",
                {"from_token": "MNT", "to_token": "WMNT", "amount_usd": 1.0},
            )

    assert result.exit_code == 0
    assert result.stdout["quoteId"] == "q1"
    assert result.dry_run is True
    assert result.latency_ms >= 0
    assert any("byreal_skill_invoked skill=mantle.swap.v1" in rec.message for rec in caplog.records)


def test_invoke_skill_timeout() -> None:
    with patch(
        "ameo_worker.services.byreal_skill.subprocess.run",
        side_effect=subprocess.TimeoutExpired(cmd=["byreal-cli"], timeout=5),
    ):
        with pytest.raises(ByrealSkillError) as exc_info:
            invoke_skill("mantle.swap.v1", {"from_token": "MNT", "to_token": "WMNT", "amount_usd": 1})

    assert "timed out" in str(exc_info.value).lower()


def test_invoke_skill_nonzero_exit() -> None:
    mock_result = MagicMock()
    mock_result.returncode = 1
    mock_result.stdout = ""
    mock_result.stderr = "unknown skill mantle.swap.v1"

    with patch("ameo_worker.services.byreal_skill.subprocess.run", return_value=mock_result):
        with pytest.raises(ByrealSkillError) as exc_info:
            invoke_skill("mantle.swap.v1", {"from_token": "MNT", "to_token": "WMNT", "amount_usd": 1})

    assert exc_info.value.exit_code == 1
    assert "unknown skill" in exc_info.value.stderr
