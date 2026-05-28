from __future__ import annotations

from typing import Any, Dict, List

from ..clients.mantle import MantleClient
from ..settings import Settings

# Deployed AgentIdentity emits 4-param DecisionLogged (Sepolia 0x8aC72a4B…4197).
_DECISION_LOGGED_EVENT_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "agentId", "type": "uint256"},
            {"indexed": False, "name": "rationaleHash", "type": "bytes32"},
            {"indexed": False, "name": "actionType", "type": "string"},
            {"indexed": False, "name": "metadataUri", "type": "string"},
        ],
        "name": "DecisionLogged",
        "type": "event",
    },
]

DEFAULT_LOOKBACK_BLOCKS = 350_000


def _hex_value(value: Any) -> str:
    if value is None:
        return ""
    if hasattr(value, "hex"):
        return value.hex()
    return str(value)


def fetch_decision_logs(settings: Settings, from_block: int = 0) -> List[Dict[str, Any]]:
    """Read DecisionLogged events via the Python worker's Mantle RPC client."""
    if not settings.agent_identity_address:
        return []

    mantle = MantleClient(settings)
    w3 = mantle.w3
    contract = w3.eth.contract(
        address=w3.to_checksum_address(settings.agent_identity_address),
        abi=_DECISION_LOGGED_EVENT_ABI,
    )
    latest = w3.eth.block_number
    if from_block <= 0:
        start_block = max(0, latest - DEFAULT_LOOKBACK_BLOCKS)
    else:
        start_block = max(0, from_block)
    entries = contract.events.DecisionLogged.get_logs(from_block=start_block)

    logs: List[Dict[str, Any]] = []
    for entry in reversed(entries):
        args = entry["args"]
        metadata_uri = args.get("metadataUri", "")
        logs.append(
            {
                "txHash": _hex_value(entry.get("transactionHash")),
                "agentId": str(args.get("agentId", settings.agent_token_id)),
                "rationaleHash": _hex_value(args.get("rationaleHash")),
                "actionType": args.get("actionType", ""),
                "metadataUri": metadata_uri,
                # 0G root is written into metadataUri when anchored.
                "dataHash": metadata_uri if str(metadata_uri).startswith("0x") else "",
            }
        )
    return logs
