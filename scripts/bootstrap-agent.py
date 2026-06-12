#!/usr/bin/env python3
"""Fund agent wallet (optional), mint AgentIdentity NFT, verify DEX smoke prerequisites."""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKER_ROOT = REPO_ROOT / "apps" / "worker"
sys.path.insert(0, str(WORKER_ROOT))
os.chdir(REPO_ROOT)

from web3 import Web3  # noqa: E402

from ameo_worker.adapters.mantle_dex import MantleDexAdapter  # noqa: E402
from ameo_worker.clients.mantle import MantleClient  # noqa: E402
from ameo_worker.services.onchain_logger import OnchainLogger  # noqa: E402
from ameo_worker.settings import get_settings  # noqa: E402

MIN_AGENT_MNT = 0.015


def _fund_agent_if_configured(w3: Web3, agent: str, treasury_key: str, treasury: str) -> None:
    amount_wei = w3.to_wei(0.05, "ether")
    agent_balance = w3.eth.get_balance(w3.to_checksum_address(agent))
    if agent_balance >= w3.to_wei(MIN_AGENT_MNT, "ether"):
        print(f"Agent balance OK: {w3.from_wei(agent_balance, 'ether')} MNT")
        return

    treasury_acct = w3.eth.account.from_key(treasury_key)
    if treasury_acct.address.lower() != treasury.lower():
        print(
            "TREASURY_PRIVATE_KEY address does not match TREASURY_EOA; skipping auto-fund."
        )
        return

    tx = {
        "from": treasury_acct.address,
        "to": w3.to_checksum_address(agent),
        "value": amount_wei,
        "nonce": w3.eth.get_transaction_count(treasury_acct.address, "pending"),
        "gas": 21_000,
        "gasPrice": w3.eth.gas_price,
        "chainId": w3.eth.chain_id,
    }
    signed = w3.eth.account.sign_transaction(tx, private_key=treasury_key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
    if receipt.status != 1:
        raise RuntimeError(f"Treasury fund tx reverted: {tx_hash.hex()}")
    print(f"Funded agent with 0.05 MNT: {tx_hash.hex()}")


def main() -> int:
    get_settings.cache_clear()
    settings = get_settings()
    mantle = MantleClient(settings)
    w3 = mantle.w3
    agent = w3.eth.account.from_key(settings.agent_private_key).address

    print("=== AMEO agent bootstrap ===")
    print("chain_id:", settings.mantle_chain_id)
    print("rpc:", mantle.active_rpc)
    print("agent:", agent)
    print("treasury:", settings.treasury_eoa or "(unset)")

    treasury_key = os.environ.get("TREASURY_PRIVATE_KEY", "").strip()
    if treasury_key and settings.treasury_eoa:
        _fund_agent_if_configured(w3, agent, treasury_key, settings.treasury_eoa)
    else:
        balance = w3.from_wei(w3.eth.get_balance(w3.to_checksum_address(agent)), "ether")
        print(f"Agent balance: {balance} MNT")
        if balance < MIN_AGENT_MNT:
            print(
                f"WARNING: fund agent with ≥{MIN_AGENT_MNT} MNT for mint + cycles, "
                "or set TREASURY_PRIVATE_KEY for auto-fund."
            )

    if settings.agent_identity_address:
        gas_price = w3.eth.gas_price
        agent_balance = w3.eth.get_balance(w3.to_checksum_address(agent))
        mint_reserve = w3.to_wei(0.005, "ether")
        if agent_balance < mint_reserve:
            print(
                f"Skipping AgentIdentity mint (balance {w3.from_wei(agent_balance, 'ether')} MNT "
                f"< ~0.005 MNT reserve at gas {gas_price})."
            )
        elif not settings.identity_auto_mint:
            print(
                "NFT not minted. One-shot: set IDENTITY_AUTO_MINT=true + IDENTITY_OWNER_PRIVATE_KEY, "
                "run this script, then remove both from Render."
            )
        else:
            try:
                logger = OnchainLogger(settings)
                token_id = logger._ensure_agent_minted(settings.agent_token_id, agent)
                print(f"Agent NFT ready: tokenId={token_id}")
                print("Remove IDENTITY_OWNER_PRIVATE_KEY and IDENTITY_AUTO_MINT from production env.")
            except Exception as exc:
                print(f"AgentIdentity mint skipped: {exc}")

    probe = MantleDexAdapter(settings).probe_dex()
    print("DEX probe pass:", probe.get("pass"), "router:", probe.get("router"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
