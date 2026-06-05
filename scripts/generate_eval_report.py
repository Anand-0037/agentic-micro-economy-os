#!/usr/bin/env python3
"""Generate eval_report.json from MemoryDB metrics (hackathon eval harness).

Run from the `agentic-micro-economy-os` directory so `.env` is discoverable:

    cd agentic-micro-economy-os
    uv run python scripts/generate_eval_report.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.chdir(ROOT)

WORKER_PKG = ROOT / "apps" / "worker"
if str(WORKER_PKG) not in sys.path:
    sys.path.insert(0, str(WORKER_PKG))

from ameo_worker.services.memory_db import MemoryDB  # noqa: E402
from ameo_worker.settings import get_settings  # noqa: E402


def main() -> int:
    settings = get_settings()
    db = MemoryDB(settings)
    perf = db.performance()
    hist = db.history(limit=500)
    best = db.best_win()
    out_path = (
        Path(settings.eval_report_path.strip())
        if settings.eval_report_path.strip()
        else WORKER_PKG / "eval_report.json"
    )
    if len(sys.argv) > 1:
        out_path = Path(sys.argv[1])
    out_path.parent.mkdir(parents=True, exist_ok=True)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "window_days": 7,
        "sample_count": len(hist),
        "sharpe_ratio": round(float(perf.get("sharpe", 0.0)), 6),
        "max_drawdown": round(float(perf.get("drawdown", 0.0)), 6),
        "pnl_series_tail": [float(x["pnl"]) for x in hist[-24:]],
        "best_win": best,
        "limitations": [
            "Short history bias — testnet sample only",
            "Sharpe proxy omitted when sample_count < 5",
            "Gas costs dominate on small execution wallets",
            "FusionX V2 DEX liquidity thin on Mantle Sepolia — native ping fallback used",
        ],
        "note": "Regenerate: cd apps/worker && uv run python ../../scripts/generate_eval_report.py",
    }
    out_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
