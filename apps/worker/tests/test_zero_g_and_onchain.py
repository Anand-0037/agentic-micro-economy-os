from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from ameo_worker.graph import log
from ameo_worker.models import ActionPlan, ExecutionResult, ObservationSnapshot
from ameo_worker.services.onchain_logger import _AGENT_IDENTITY_ABI
from ameo_worker.services.zero_g_storage import ZeroGAnchorResult, ZeroGStorageService, parse_root_hash
from ameo_worker.settings import Settings


def test_log_decision_abi_matches_contract() -> None:
    fn = next(item for item in _AGENT_IDENTITY_ABI if item.get("name") == "logDecision")
    assert [arg["name"] for arg in fn["inputs"]] == [
        "agentId",
        "rationaleHash",
        "actionType",
        "metadataUri",
    ]


def test_decision_logged_event_name() -> None:
    event = next(item for item in _AGENT_IDENTITY_ABI if item.get("type") == "event")
    assert event["name"] == "DecisionLogged"
    assert "metadataUri" in {arg["name"] for arg in event["inputs"]}


def test_parse_root_hash_from_cli_output() -> None:
    output = "✓ File uploaded successfully\nRoot hash: 0xabc123\n"
    assert parse_root_hash(output) == "0xabc123"

    output = "root=0xdeadbeef"
    assert parse_root_hash(output) == "0xdeadbeef"


def test_anchor_success() -> None:
    settings = Settings(
        ZERO_G_RPC_URL="https://rpc.example",
        ZERO_G_INDEXER_URL="https://indexer.example",
        ZERO_G_PRIVATE_KEY="0x" + "11" * 32,
        ZERO_G_CLI_PATH="0g-storage-client",
    )
    service = ZeroGStorageService(settings)
    mock_result = MagicMock()
    mock_result.returncode = 0
    mock_result.stdout = "Root hash: 0xabc123def456\n"
    mock_result.stderr = ""

    with patch("ameo_worker.services.zero_g_storage.subprocess.run", return_value=mock_result):
        anchor = service.anchor_trace({"cycle_id": "cyc_test"}, cycle_id="cyc_test")

    assert anchor.anchored is True
    assert anchor.root_hash == "0xabc123def456"
    assert anchor.indexer_url == "https://indexer.example"


def test_anchor_failure_graceful(caplog: pytest.LogCaptureFixture) -> None:
    settings = Settings(
        ZERO_G_RPC_URL="https://rpc.example",
        ZERO_G_INDEXER_URL="https://indexer.example",
        ZERO_G_PRIVATE_KEY="0x" + "11" * 32,
        ZERO_G_CLI_PATH="0g-storage-client",
    )
    service = ZeroGStorageService(settings)
    mock_result = MagicMock()
    mock_result.returncode = 1
    mock_result.stdout = ""
    mock_result.stderr = "upload rejected"

    with caplog.at_level("WARNING", logger="ameo.zero_g"):
        with patch("ameo_worker.services.zero_g_storage.subprocess.run", return_value=mock_result):
            anchor = service.anchor_trace({"cycle_id": "cyc_fail"}, cycle_id="cyc_fail")

    assert anchor.anchored is False
    assert anchor.root_hash is None
    assert any("zero_g_anchor_failed" in rec.message for rec in caplog.records)


def test_log_node_uses_empty_metadata_when_anchor_fails() -> None:
    plan = ActionPlan(
        action_type="swap",
        idempotency_key="k1",
        correlation_id="c1",
        rationale="test rationale",
    )
    observation = ObservationSnapshot(balances={"MNT": 1.0})
    execution = ExecutionResult(ok=True, command="treasury_ping", dry_run=False, tx_hash="0xabc")
    state = {
        "cycle_id": "cyc_log_test",
        "plan": plan,
        "observation": observation,
        "execution": execution,
        "guardrail_ok": True,
        "violations": [],
        "byreal_skill_result": None,
    }

    failed_anchor = ZeroGAnchorResult(root_hash=None, indexer_url=None, anchored=False)
    with patch("ameo_worker.graph._memory") as memory_mock:
        memory_mock.return_value.record_execution = MagicMock()
        with patch("ameo_worker.graph.ZeroGStorageService") as service_cls:
            service_cls.return_value.is_configured.return_value = True
            service_cls.return_value.anchor_trace.return_value = failed_anchor
        with patch("ameo_worker.graph.EventStore") as event_store_cls:
            event_store_cls.return_value.get_cycle_events.return_value = []
            event_store_cls.return_value.emit = MagicMock()
        with patch("ameo_worker.graph.OnchainLogger") as logger_cls:
            logger_cls.return_value.log_decision.return_value = {"tx_hash": "0x1"}
            with patch("ameo_worker.graph.update_status"):
                result = log(state)

    logger_cls.return_value.log_decision.assert_called_once()
    assert logger_cls.return_value.log_decision.call_args[0][4] == ""
    assert result.get("zero_g") is None
