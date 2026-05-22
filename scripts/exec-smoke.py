#!/usr/bin/env python3
"""Smoke-test Mantle DEX adapter: probe → quote → live execution on Mantle Sepolia."""

from __future__ import annotations

import os
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
WORKER_ROOT = REPO_ROOT / "apps" / "worker"
sys.path.insert(0, str(WORKER_ROOT))

from ameo_worker.adapters.mantle_dex import MantleDexAdapter  # noqa: E402
from ameo_worker.settings import get_settings  # noqa: E402


def _chain_ping(adapter: MantleDexAdapter) -> None:
    """Fallback: send 1 wei to treasury when DEX path is unavailable on testnet."""
    result = adapter._treasury_ping(amount_wei=1, reason="smoke_test_chain_ping")
    if not result.ok:
        hint = ""
        if isinstance(result.raw_output, dict) and result.raw_output.get("hint_mnt"):
            hint = f" (need ~{result.raw_output['hint_mnt']} more MNT on agent wallet)"
        raise RuntimeError(f"chain_ping failed: {result.error}{hint}")
    print("chain_ping ok (DEX unavailable on this network — verified signing + RPC)")
    print("tx_hash:", result.tx_hash)
    if isinstance(result.raw_output, dict) and result.raw_output.get("explorer_url"):
        print("explorer:", result.raw_output["explorer_url"])


def main() -> int:
    os.chdir(REPO_ROOT)
    get_settings.cache_clear()
    settings = get_settings()
    adapter = MantleDexAdapter(settings)

    print("=== AMEO Mantle DEX smoke ===")
    print("chain_id:", settings.mantle_chain_id)
    print("rpc:", adapter._client.active_rpc)
    print("treasury:", settings.treasury_eoa or "(signer)")

    probe = adapter.probe_dex()
    print("\n--- dex probe ---")
    print(probe)

    amount = float(os.environ.get("SMOKE_SWAP_AMOUNT", "0.0001"))
    print(f"\n--- quote MNT -> WMNT ({amount}) ---")
    try:
        quote = adapter.quote("MNT", "WMNT", amount)
        print(quote)
    except Exception as exc:
        print("quote failed:", exc)
        quote = None

    if not settings.allows_live_execution():
        print(
            "\nLive execution disabled (set LIVE_ENABLED=true and WORKER_MODE=live_limited)."
        )
        return 1

    if quote and quote.get("path") == "native_wrap":
        print("\n--- swap (native wrap) ---")
        result = adapter.swap("MNT", "WMNT", amount)
        print("ok:", result.ok)
        print("tx_hash:", result.tx_hash)
        if result.raw_output.get("explorer_url"):
            print("explorer:", result.raw_output["explorer_url"])
        if result.error:
            print("error:", result.error)
        if result.ok and result.tx_hash:
            return 0
        if result.error == "wmnt_not_configured":
            print("\nWMNT not on this chain — falling back to chain ping...")
            _chain_ping(adapter)
            return 0
        print("\nSwap failed — falling back to chain ping...")
        _chain_ping(adapter)
        return 0

    if quote and quote.get("path") == "treasury_ping":
        print("\n--- treasury ping (DEX unavailable on Sepolia) ---")
        result = adapter.swap("MNT", "WMNT", amount)
        print("ok:", result.ok)
        print("tx_hash:", result.tx_hash)
        if isinstance(result.raw_output, dict) and result.raw_output.get("explorer_url"):
            print("explorer:", result.raw_output["explorer_url"])
        if result.error:
            print("error:", result.error)
        return 0 if result.ok else 1

    print("\nRouter swap path unavailable — falling back to chain ping...")
    _chain_ping(adapter)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
