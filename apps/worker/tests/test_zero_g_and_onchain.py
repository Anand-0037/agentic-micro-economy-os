from ameo_worker.services.onchain_logger import _AGENT_IDENTITY_ABI
from ameo_worker.services.zero_g_storage import parse_root_hash


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
