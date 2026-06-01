from __future__ import annotations

from typing import Optional

from ..models import ActionPlan, ExecutionStep, ObservationSnapshot
from ..settings import Settings


def build_delta_neutral_plan(
    observation: ObservationSnapshot,
    settings: Settings,
    lp_pair: str = "MNT/USDC",
) -> Optional[ActionPlan]:
    """
    Currently returns None for most cases.

    Full delta-neutral (LP + perps) is not yet supported by the MantleDexAdapter.
    This planner is intentionally conservative until LP/perps primitives are wired.
    """
    tickers = observation.macro_signals.get("tickers", {})
    mnt = tickers.get("MNTUSDT", {}) if isinstance(tickers, dict) else {}
    price_change_pct = abs(float(mnt.get("price_change_pct", 0) or 0))

    if price_change_pct < settings.volatility_threshold_pct:
        return None

    # TODO: When LP + perps adapters exist, re-enable real hedging.
    # For now, we refuse to emit unsupported action types to avoid silent no-ops or errors.
    return None
