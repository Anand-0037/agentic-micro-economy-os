from __future__ import annotations

from typing import Optional

from ..models import ActionPlan, ExecutionStep, ObservationSnapshot
from ..settings import Settings


def build_delta_neutral_plan(
    observation: ObservationSnapshot,
    settings: Settings,
    lp_pair: str = "MNT/USDC",
) -> Optional[ActionPlan]:
    tickers = observation.macro_signals.get("tickers", {})
    mnt = tickers.get("MNTUSDT", {}) if isinstance(tickers, dict) else {}
    price_change_pct = abs(float(mnt.get("price_change_pct", 0) or 0))

    if price_change_pct < settings.volatility_threshold_pct:
        return None

    usdc_balance = observation.balances.get("USDC", 0.0)
    mnt_balance = observation.balances.get("MNT", 0.0)
    lp_amount = usdc_balance * 0.1
    perp_amount = mnt_balance * 0.1

    if lp_amount <= 0 or perp_amount <= 0:
        return None

    steps = [
        ExecutionStep(
            action_type="lp_add",
            action_params={"pair": lp_pair, "amount": lp_amount},
        ),
        ExecutionStep(
            action_type="perps_open",
            asset_in="MNT",
            action_params={"side": "short", "amount": perp_amount, "symbol": "MNTUSDT"},
        ),
    ]

    return ActionPlan(
        action_type="bundle",
        idempotency_key="delta-neutral-bundle",
        correlation_id="delta-neutral-bundle",
        planner="delta-neutral@v1",
        rationale="Volatility spike detected. Entering LP + short perp hedge to reduce delta exposure.",
        rationale_summary="Volatility high; hedged LP via short perp.",
        steps=steps,
        action_params={"strategy": "delta_neutral"},
    )
