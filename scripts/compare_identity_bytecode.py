#!/usr/bin/env python3
"""
Small script to compare on-chain deployed bytecode of the AgentIdentity contract
against the current compiled artifact.

Usage:
  python scripts/compare_identity_bytecode.py [RPC_URL] [CONTRACT_ADDRESS]

Defaults to Mantle Sepolia RPC and the known deployed address.
"""
import json
import sys
from pathlib import Path
from web3 import Web3

DEFAULT_RPC = "https://rpc.sepolia.mantle.xyz"
DEFAULT_ADDR = "0xB86dC64573089D8DD89C5686010295bB4412D652"

def main():
    rpc = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_RPC
    addr = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_ADDR

    w3 = Web3(Web3.HTTPProvider(rpc))
    if not w3.is_connected():
        print(f"ERROR: Cannot connect to {rpc}")
        sys.exit(1)

    checksum_addr = w3.to_checksum_address(addr)
    print(f"RPC: {rpc}")
    print(f"Contract: {checksum_addr}")

    onchain_code = w3.eth.get_code(checksum_addr)
    print(f"On-chain code size: {len(onchain_code)} bytes")

    # Load artifact
    artifact_path = Path(__file__).resolve().parents[1] / "packages" / "contracts" / "out" / "MantleAgentIdentity.sol" / "AgentIdentity.json"
    if not artifact_path.exists():
        print(f"ERROR: Artifact not found at {artifact_path}")
        sys.exit(1)

    with open(artifact_path) as f:
        artifact = json.load(f)

    # The json is usually {"abi": [...], "bytecode": {...}, "deployedBytecode": {...}, ...}
    deployed = artifact.get("deployedBytecode", {})
    if isinstance(deployed, dict):
        artifact_hex = deployed.get("object", "")
    else:
        artifact_hex = deployed or ""

    if artifact_hex.startswith("0x"):
        artifact_hex = artifact_hex[2:]

    artifact_bytes = bytes.fromhex(artifact_hex) if artifact_hex else b""
    print(f"Artifact deployedBytecode size: {len(artifact_bytes)} bytes")

    onchain_hex = onchain_code.hex()
    if onchain_hex.startswith("0x"):
        onchain_hex = onchain_hex[2:]

    if not artifact_bytes:
        print("WARNING: No deployedBytecode found in artifact (may need `forge build`).")
        return

    if onchain_hex == artifact_hex:
        print("✅ BYTECODE MATCHES (exact deployed code on chain == current artifact)")
    else:
        print("❌ BYTECODE DIFFERS")
        print(f"   On-chain keccak: 0x{w3.keccak(onchain_code).hex()}")
        print(f"   Artifact keccak: 0x{w3.keccak(artifact_bytes).hex()}")
        print("   (Likely needs redeploy of the updated contract source.)")

    # Also print a few public vars for sanity if possible
    try:
        simple_abi = [
            {"name": "nextTokenId", "inputs": [], "outputs": [{"type": "uint256"}], "type": "function", "stateMutability": "view"},
            {"name": "symbol", "inputs": [], "outputs": [{"type": "string"}], "type": "function", "stateMutability": "view"},
        ]
        c = w3.eth.contract(address=checksum_addr, abi=simple_abi)
        print(f"Sanity: nextTokenId() = {c.functions.nextTokenId().call()}")
        print(f"Sanity: symbol() = {c.functions.symbol().call()}")
    except Exception as e:
        print(f"Sanity read failed (expected if old deployment or no code): {e}")

if __name__ == "__main__":
    main()
