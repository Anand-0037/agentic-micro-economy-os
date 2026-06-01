from __future__ import annotations

import uuid
from typing import List, Optional

from ..models import ActionPlan, ObservationSnapshot
from ..settings import Settings


def build_rules_action_plan(
    observation: ObservationSnapshot,
    settings: Settings,
    lessons: Optional[List[str]] = None,
) -> ActionPlan:
    """Deterministic planner used when the LLM is unavailable (LOCKED downgrade path)."""
    cycle_suffix = uuid.uuid4().hex[:8]
    mnt_balance = float(observation.balances.get("MNT", 0.0) or 0.0)
    gas_price = observation.gas_price_wei or 50_000_000_000
    min_mnt = (21_000 * gas_price * 4) / 1e18  # exec + log headroom

    if observation.observation_quality < 0.5:
        return _no_op(
            cycle_suffix,
            "Observation quality too low for autonomous execution.",
        )

    if lessons:
        return _no_op(
            cycle_suffix,
            "Recent failures detected; holding until operator review.",
        )

    if not settings.allows_live_execution():
        return _no_op(
            cycle_suffix,
            "Live execution disabled; rules planner holding.",
        )

    if mnt_balance < min_mnt:
        return _no_op(
            cycle_suffix,
            f"Insufficient MNT for gas headroom (need ~{min_mnt:.4f}, have {mnt_balance:.4f}).",
        )

    if mnt_balance < 0.0002:
        return _no_op(
            cycle_suffix,
            "Insufficient MNT on execution wallet for a guarded micro-swap.",
        )

    # MVP: volatility response when market signals show a real move
    price_change = abs(float(observation.macro_signals.get("mnt_price_change_pct", 0) or 0))
    if price_change > 2.0 and mnt_balance > 0.001:
        # Small rebalance when volatility detected — more interesting than constant tiny wrap
        swap_amount = min(0.0005, mnt_balance * 0.08)
        rationale = (
            f"Rules fallback + volatility response: MNT moved {price_change:.1f}% recently. "
            "Executing small policy-capped rebalance to keep exposure balanced while LLM is unavailable. "
            "This demonstrates the agent adapting to market signals even in fallback mode."
        )
        return ActionPlan(
            action_type="swap",
            protocol="merchant_moe",
            asset_in="MNT",
            asset_out="WMNT",
            size_usd=swap_amount,
            action_params={"amount": swap_amount},
            max_slippage_bps=settings.dex_slippage_bps,
            rationale=rationale,
            rationale_summary=f"Rules: volatility rebalance ({price_change:.1f}% move) - interesting demo action",
            metadata_uri="rules://mantle-dex/volatility-rebalance",
            idempotency_key=f"rules-{cycle_suffix}",
            correlation_id=f"rules-{cycle_suffix}",
            planner="rules@mantis-v1",
        )

    # Default safe micro action
    swap_amount = min(0.00015, max(0.00005, mnt_balance * 0.04))
    rationale = (
        "Rules fallback (LLM providers rate-limited or unavailable): Executing a "
        "policy-capped micro MNT→WMNT wrap on Merchant Moe. This keeps the full "
        "observe-plan-guard-act-log loop exercised and independently verifiable on "
        "Mantle + the agent identity contract while higher-intelligence planners are degraded."
    )

    return ActionPlan(
        action_type="swap",
        protocol="merchant_moe",
        asset_in="MNT",
        asset_out="WMNT",
        size_usd=swap_amount,
        action_params={"amount": swap_amount},
        max_slippage_bps=settings.dex_slippage_bps,
        rationale=rationale,
        rationale_summary="Rules: micro MNT→WMNT wrap (full verifiable loop under guardrails)",
        metadata_uri="rules://mantle-dex/auditable-micro-action",
        idempotency_key=f"rules-{cycle_suffix}",
        correlation_id=f"rules-{cycle_suffix}",
        planner="rules@mantis-v1",
    )


def _no_op(cycle_suffix: str, rationale: str) -> ActionPlan:
    return ActionPlan(
        action_type="no_op",
        idempotency_key=f"rules-noop-{cycle_suffix}",
        correlation_id=f"rules-noop-{cycle_suffix}",
        rationale=rationale,
        rationale_summary=rationale[:280],
        planner="rules@mantis-v1",
    )
