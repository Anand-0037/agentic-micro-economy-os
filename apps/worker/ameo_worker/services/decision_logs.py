from __future__ import annotations

import logging
from typing import Any, Dict, List

from ..clients.mantle import MantleClient
from ..settings import Settings

logger = logging.getLogger(__name__)

# Full event from updated MantleAgentIdentity.sol (ERC-8004 profile ready).
# Supports both old V1 logs (pre-PnL) and new V2 with signedPnL1e18 + dataHash.
_DECISION_LOGGED_EVENT_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "name": "agentId", "type": "uint256"},
            {"indexed": False, "name": "rationaleHash", "type": "bytes32"},
            {"indexed": False, "name": "signedPnL1e18", "type": "int256"},
            {"indexed": False, "name": "actionType", "type": "string"},
            {"indexed": False, "name": "metadataUri", "type": "string"},
            {"indexed": False, "name": "dataHash", "type": "string"},
            {"indexed": False, "name": "operator", "type": "address"},
        ],
        "name": "DecisionLogged",
        "type": "event",
    },
]

# Mantle RPC endpoints reject wide eth_getLogs ranges (400). Query in small chunks.
CHUNK_SIZE = 4_000
DEFAULT_LOOKBACK_BLOCKS = 50_000


def _hex_value(value: Any) -> str:
    if value is None:
        return ""
    if hasattr(value, "hex"):
        return value.hex()
    return str(value)


def _resolve_start_block(settings: Settings, latest: int, from_block: int) -> int:
    if from_block > 0:
        start = max(0, from_block)
    elif settings.log_from_block > 0:
        start = settings.log_from_block
    else:
        start = max(0, latest - DEFAULT_LOOKBACK_BLOCKS)
    # Never scan more than DEFAULT_LOOKBACK_BLOCKS — wide eth_getLogs ranges 400 on Mantle RPCs.
    floor = max(0, latest - DEFAULT_LOOKBACK_BLOCKS)
    return max(start, floor)


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
    start_block = _resolve_start_block(settings, latest, from_block)

    entries: list[Any] = []
    cursor = start_block
    while cursor <= latest:
        chunk_end = min(cursor + CHUNK_SIZE - 1, latest)
        try:
            chunk = contract.events.DecisionLogged.get_logs(
                from_block=cursor,
                to_block=chunk_end,
            )
            entries.extend(chunk)
        except Exception as exc:
            logger.warning(
                "DecisionLogged chunk failed blocks=%s-%s: %s",
                cursor,
                chunk_end,
                exc,
            )
        cursor = chunk_end + 1

    logs: List[Dict[str, Any]] = []
    for entry in reversed(entries):
        args = entry["args"]
        metadata_uri = args.get("metadataUri", "") or ""
        data_hash = args.get("dataHash", "") or ""
        # Prefer explicit dataHash; fallback to metadata if it looks like root hash (for older logs)
        if not data_hash and str(metadata_uri).startswith("0x"):
            data_hash = metadata_uri
        logs.append(
            {
                "txHash": _hex_value(entry.get("transactionHash")),
                "agentId": str(args.get("agentId", settings.agent_token_id)),
                "rationaleHash": _hex_value(args.get("rationaleHash")),
                "signedPnL1e18": str(args.get("signedPnL1e18", 0)),
                "pnl1e18": str(args.get("signedPnL1e18", 0)),  # compat for old VerifiableLog type
                "actionType": args.get("actionType", ""),
                "metadataUri": metadata_uri,
                "dataHash": data_hash,
            }
        )
    return logs
