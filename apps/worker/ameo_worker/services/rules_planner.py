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

    swap_amount = min(0.0001, mnt_balance * 0.05)
    return ActionPlan(
        action_type="swap",
        protocol="merchant_moe",
        asset_in="MNT",
        asset_out="WMNT",
        size_usd=swap_amount,
        action_params={"amount": swap_amount},
        max_slippage_bps=settings.dex_slippage_bps,
        rationale=(
            "Rules planner: fund-verified micro MNT→WMNT wrap on Mantle to keep "
            "the treasury loop auditable while LLM cognition is degraded."
        ),
        rationale_summary="Rules fallback: tiny MNT→WMNT wrap under policy caps.",
        metadata_uri="rules://mantle-dex/micro-wrap",
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
