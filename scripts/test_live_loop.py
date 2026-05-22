"""Run live observe->reason->act->log cycles against Mantle.

WARNING: This script sends real transactions. Ensure .env is configured and funded.
Set VOLATILITY_THRESHOLD_PCT low if you want to force a rebalance scenario.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKER_PATH = ROOT / "apps" / "worker"
if str(WORKER_PATH) not in sys.path:
    sys.path.append(str(WORKER_PATH))

from ameo_worker.agent import run_cycle  # noqa: E402


async def main() -> None:
    first = await run_cycle()
    print(first)
    second = await run_cycle()
    print(second)


if __name__ == "__main__":
    asyncio.run(main())
