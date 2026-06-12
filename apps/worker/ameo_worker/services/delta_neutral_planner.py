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
    Emits real delta-hedge plans when volatility spikes: primarily LP add for yield on volatile pair,
    with optional perps_open step (executed as proxy hedge via adapter until full perp router wired).

    This closes the previous "hardcoded None" gap. LP uses MantleDexAdapter.add_liquidity (V2 router).
    Perps uses synthetic hedge (opposite swap + labeled tx) for demo; full Orderly-style perps pending.
    """
    tickers = observation.macro_signals.get("tickers", {})
    mnt = tickers.get("MNTUSDT", {}) if isinstance(tickers, dict) else {}
    price_change_pct = abs(float(mnt.get("price_change_pct", 0) or 0))

    if price_change_pct < settings.volatility_threshold_pct:
        return None

    # Volatility triggered: provide liquidity as core of delta-neutral yield (long exposure + fees).
    # Size small per policy; use USDC + MNT (native handled in adapter).
    amount_usd = min(50.0, settings.max_position_usd or 50.0)  # conservative slice

    # Emit as BUNDLE: lp_add + perps_open (perps executes as synthetic opposite-swap hedge in adapter)
    # This matches P-002 prompt expectation and makes both action types exercised.
    step_lp = ExecutionStep(
        action_type="lp_add",
        asset_in="USDC",
        asset_out="MNT",
        size_usd=amount_usd * 0.6,
        action_params={"amount_a": amount_usd * 0.3, "amount_b": amount_usd * 0.3, "pair": lp_pair},
    )
    step_perp = ExecutionStep(
        action_type="perps_open",
        asset_in="MNT",
        asset_out="USDC",
        size_usd=amount_usd * 0.4,
        action_params={"hedge": "synthetic", "note": "proxy via opposite swap until real perp router"},
    )
    plan = ActionPlan(
        action_type="bundle",
        protocol="fusionx_v2",
        asset_in="USDC",
        asset_out="MNT",
        size_usd=amount_usd,
        rationale_summary=f"High vol ({price_change_pct:.1%} MNT) -> delta bundle: LP yield + perp hedge proxy.",
        rationale="Delta-neutral: LP for fees/yield on volatile pair + small opposite exposure via perps proxy in adapter (full Orderly perps not wired).",
        steps=[step_lp, step_perp],
        action_params={"vol_trigger": price_change_pct},
        idempotency_key=f"delta-bundle-{int(price_change_pct*1000)}",
        correlation_id=f"delta-{hash(str(price_change_pct)) % 100000}",
        planner="delta_neutral_planner@v1",
    )
    return plan
