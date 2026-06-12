#!/usr/bin/env python3
"""Operator preflight: signing address, NFT ownership, contract bytecode sanity."""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKER_ROOT = REPO_ROOT / "apps" / "worker"
sys.path.insert(0, str(WORKER_ROOT))

from web3 import Web3  # noqa: E402

from ameo_worker.identity_status import (  # noqa: E402
    inspect_identity_readiness,
    signing_eoa_from_settings,
)
from ameo_worker.settings import get_settings  # noqa: E402

DEFAULT_ADDR = "0xB86dC64573089D8DD89C5686010295bB4412D652"


def _bytecode_hint(rpc: str, addr: str) -> None:
    w3 = Web3(Web3.HTTPProvider(rpc))
    if not w3.is_connected():
        print("RPC: not connected")
        return
    code = w3.eth.get_code(w3.to_checksum_address(addr))
    artifact = (
        REPO_ROOT
        / "packages"
        / "contracts"
        / "out"
        / "MantleAgentIdentity.sol"
        / "AgentIdentity.json"
    )
    print(f"On-chain bytecode: {len(code)} bytes")
    if artifact.exists():
        with open(artifact) as f:
            deployed = json.load(f).get("deployedBytecode", {})
        artifact_hex = deployed.get("object", "") if isinstance(deployed, dict) else deployed
        if artifact_hex.startswith("0x"):
            artifact_hex = artifact_hex[2:]
        if artifact_hex and code.hex() == artifact_hex:
            print("Bytecode: matches local MantleAgentIdentity.sol artifact")
        elif artifact_hex:
            print("Bytecode: DIFFERS from local artifact (redeploy may be needed)")
    else:
        print("Bytecode: run `forge build` in packages/contracts to compare")


def main() -> int:
    get_settings.cache_clear()
    settings = get_settings()
    signing = signing_eoa_from_settings(settings)
    print("=== AMEO identity preflight ===")
    print("signing_eoa (from AGENT_PRIVATE_KEY):", signing or "(unset)")
    print("AGENT_EOA configured:", settings.agent_eoa or "(unset)")
    print("identity:", settings.agent_identity_address)
    print("token_id:", settings.agent_token_id)

    w3 = Web3(Web3.HTTPProvider(settings.mantle_rpc_url))
    contract = None
    if w3.is_connected() and settings.agent_identity_address:
        abi_path = REPO_ROOT / "packages" / "contracts" / "out" / "MantleAgentIdentity.sol" / "AgentIdentity.json"
        if abi_path.exists():
            with open(abi_path) as f:
                abi = json.load(f)["abi"]
            contract = w3.eth.contract(
                address=w3.to_checksum_address(settings.agent_identity_address),
                abi=abi,
            )

    status = inspect_identity_readiness(settings, w3=w3, contract=contract)
    print("nft_minted:", status.get("nft_minted"))
    print("nft_owner:", status.get("nft_owner"))
    print("ready:", status.get("ready"))
    if status.get("action_required"):
        print("ACTION:", status["action_required"])

    _bytecode_hint(settings.mantle_rpc_url, settings.agent_identity_address or DEFAULT_ADDR)
    return 0 if status.get("ready") else 1


if __name__ == "__main__":
    raise SystemExit(main())
