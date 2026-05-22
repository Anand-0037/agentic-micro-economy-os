from __future__ import annotations

from typing import Any, Dict, List

from ..clients.mantle import MantleClient
from ..settings import Settings
from .onchain_logger import _AGENT_IDENTITY_ABI


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
        abi=_AGENT_IDENTITY_ABI,
    )
    latest = w3.eth.block_number
    if from_block <= 0:
        # Mantle RPC rejects very wide eth_getLogs ranges from genesis.
        start_block = max(0, latest - 5_000)
    else:
        start_block = max(0, from_block)
    entries = contract.events.DecisionLogged.get_logs(from_block=start_block)

    logs: List[Dict[str, Any]] = []
    for entry in reversed(entries):
        args = entry["args"]
        logs.append(
            {
                "txHash": _hex_value(entry.get("transactionHash")),
                "agentId": str(args.get("agentId", settings.agent_token_id)),
                "rationaleHash": _hex_value(args.get("rationaleHash")),
                "actionType": args.get("actionType", ""),
                "metadataUri": args.get("metadataUri", ""),
                "dataHash": args.get("dataHash", ""),
                "pnl1e18": str(args.get("pnl1e18", 0)),
            }
        )
    return logs
