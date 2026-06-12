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
    # Now using full V2 (6 args) with PnL + dataHash for on-chain aggregation + ERC-8004 profile
    assert [arg["name"] for arg in fn["inputs"]] == [
        "agentId",
        "rationaleHash",
        "signedPnL1e18",
        "actionType",
        "metadataUri",
        "dataHash",
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


def test_log_node_schedules_background_finalize() -> None:
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

    with patch("ameo_worker.graph._ctx") as ctx_mock:
        ctx_mock.return_value.memory.record_execution = MagicMock()
        with patch("ameo_worker.graph.asyncio.get_running_loop") as loop_mock:
            loop_mock.return_value.create_task = MagicMock()
            with patch("ameo_worker.graph.update_status"):
                with patch("ameo_worker.graph.EventStore") as event_store_cls:
                    event_store_cls.return_value.emit = MagicMock()
                    result = log(state)

    assert result["log"]["zero_g"]["status"] == "pending"
    loop_mock.return_value.create_task.assert_called_once()


def test_get_agent_route_returns_profile() -> None:
    from fastapi.testclient import TestClient
    from ameo_worker.main import app
    from ameo_worker.settings import Settings

    client = TestClient(app)

    # Mock the Settings so agent_identity_address is configured
    mock_settings = Settings(
        AGENT_IDENTITY_ADDRESS="0xEc14f781DB5f5f350F26Bc10Fb8f654e1D91daCc",
        AGENT_TOKEN_ID=0,
        API_KEY="",
    )

    with patch("ameo_worker.routes.v1.get_settings", return_value=mock_settings):
        with patch("ameo_worker.routes.v1.fetch_decision_logs", return_value=[]):
            # Mock getAgentProfile call on the contract
            mock_profile = (
                b"rationale_hash",
                100,
                500,
                10,
                "meta_uri",
                "test-capability"
            )
            with patch("web3.eth.Eth.contract") as mock_contract_cls:
                mock_contract = MagicMock()
                mock_contract.functions.getAgentProfile.return_value.call.return_value = mock_profile
                mock_contract.functions.tokenURI.return_value.call.return_value = "https://test-uri"
                mock_contract_cls.return_value = mock_contract

                response = client.get("/v1/agents/0")
                assert response.status_code == 200
                data = response.json()
                assert data["tokenId"] == 0
                assert data["totalPnL"] == "500"
                assert data["capabilities"] == ["test-capability"]
                assert data["tokenURI"] == "https://test-uri"


def test_log_decision_registers_capability() -> None:
    from ameo_worker.services.onchain_logger import OnchainLogger
    from ameo_worker.settings import Settings

    settings = Settings(
        AGENT_IDENTITY_ADDRESS="0xEc14f781DB5f5f350F26Bc10Fb8f654e1D91daCc",
        AGENT_PRIVATE_KEY="0x" + "11" * 32,
        MANTLE_CHAIN_ID=5003,
    )

    with patch("web3.eth.Eth.contract") as mock_contract_cls:
        mock_contract = MagicMock()
        mock_contract_cls.return_value = mock_contract

        # Mock ownerOf to return operator (matching Operator's address)
        mock_contract.functions.ownerOf.return_value.call.return_value = "0x" + "11" * 20

        # Mock nextTokenId call
        mock_contract.functions.nextTokenId.return_value.call.return_value = 0

        # Mock transaction building and sending
        w3_mock = MagicMock()
        w3_mock.eth.get_transaction_count.return_value = 1
        w3_mock.eth.gas_price = 1000000000
        w3_mock.eth.estimate_gas.return_value = 21000

        mock_receipt = MagicMock()
        mock_receipt.status = 1
        w3_mock.eth.wait_for_transaction_receipt.return_value = mock_receipt
        w3_mock.eth.send_raw_transaction.return_value = b"tx_hash"

        # Mock web3 account
        mock_account = MagicMock()
        mock_account.address = "0x" + "11" * 20
        w3_mock.eth.account.from_key.return_value = mock_account
        w3_mock.to_checksum_address.side_effect = lambda addr: addr

        with patch("ameo_worker.services.onchain_logger.MantleClient") as mock_mantle_client_cls:
            mock_mantle = MagicMock()
            mock_mantle.w3 = w3_mock
            mock_mantle_client_cls.return_value = mock_mantle

            logger_inst = OnchainLogger(settings)
            logger_inst._w3 = w3_mock
            logger_inst._contract = mock_contract

            # Call log_decision with a bundle action
            result = logger_inst.log_decision(
                agent_id=0,
                rationale="testing",
                pnl1e18=100,
                action_type="lp_add",
                metadata_uri="ipfs://abc",
                data_hash="0x123",
            )

            assert result["tx_hash"] == b"tx_hash".hex()
            assert result["status"] == 1

            mock_contract.functions.registerCapability.assert_called_once_with(
                0,
                "fusionx-lp-yield",
            )

