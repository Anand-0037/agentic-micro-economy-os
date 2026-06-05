from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Dict, Iterable, List, Optional

from .models import ActionPlan

if TYPE_CHECKING:
    from .settings import Settings


@dataclass
class PolicyConfig:
    """Policy constraints for the agent."""

    max_drawdown_pct: float = 0.12
    max_position_usd: float = 500.0
    max_asset_exposure_pct: float = 0.4
    hedge_drift_pct: float = 0.05
    allowed_assets: Iterable[str] = field(default_factory=list)
    allowed_protocols: Iterable[str] = field(default_factory=lambda: ["fusionx_v2"])


class PolicyEngine:
    """Evaluates ActionPlan objects against hard constraints."""

    def __init__(self, config: PolicyConfig) -> None:
        self._config = config

    def validate(
        self, plan: ActionPlan, drawdown_pct: Optional[float] = None
    ) -> List[str]:
        if plan.action_type == "no_op":
            return []

        violations: List[str] = []
        if drawdown_pct is not None and drawdown_pct > self._config.max_drawdown_pct:
            violations.append("drawdown_exceeded")

        if plan.size_usd is not None and plan.size_usd > self._config.max_position_usd:
            violations.append("max_position_exceeded")

        if self._config.allowed_assets:
            if plan.asset_in and plan.asset_in not in self._config.allowed_assets:
                violations.append("asset_in_not_allowed")
            if plan.asset_out and plan.asset_out not in self._config.allowed_assets:
                violations.append("asset_out_not_allowed")

        if self._config.allowed_protocols:
            if plan.protocol and plan.protocol not in self._config.allowed_protocols:
                violations.append("protocol_not_allowed")

        return violations

    def is_allowed(
        self, plan: ActionPlan, drawdown_pct: Optional[float] = None
    ) -> bool:
        return len(self.validate(plan, drawdown_pct=drawdown_pct)) == 0

    def exposure_violations(self, balances: Optional[dict]) -> List[str]:
        if not balances:
            return []
        total = sum(balances.values())
        if total <= 0:
            return []
        violations: List[str] = []
        for asset, amount in balances.items():
            if amount / total > self._config.max_asset_exposure_pct:
                violations.append(f"exposure_cap_exceeded:{asset}")
        return violations

    def should_force_rebalance(self, hedge_drift_pct: Optional[float]) -> bool:
        if hedge_drift_pct is None:
            return False
        return hedge_drift_pct > self._config.hedge_drift_pct


def policy_config_from_settings(settings: "Settings") -> PolicyConfig:
    """Merge PRD env caps with code defaults."""
    base = PolicyConfig()
    max_pos = (
        settings.max_position_usd if settings.max_position_usd > 0 else base.max_position_usd
    )
    max_dd = (
        settings.max_drawdown_pct if settings.max_drawdown_pct > 0 else base.max_drawdown_pct
    )
    wl_raw = (settings.asset_whitelist or "").strip()
    allowed = [a.strip().upper() for a in wl_raw.split(",") if a.strip()] if wl_raw else []
    return PolicyConfig(
        max_drawdown_pct=max_dd,
        max_position_usd=max_pos,
        max_asset_exposure_pct=base.max_asset_exposure_pct,
        hedge_drift_pct=base.hedge_drift_pct,
        allowed_assets=allowed or base.allowed_assets,
        allowed_protocols=base.allowed_protocols,
    )


def serialize_default_policy(settings: Optional["Settings"] = None) -> Dict[str, Any]:
    """JSON-serializable policy for operator UI and docs alignment."""
    if settings is not None:
        config = policy_config_from_settings(settings)
    else:
        config = PolicyConfig()
    return {
        "max_drawdown_pct": config.max_drawdown_pct,
        "max_position_usd": config.max_position_usd,
        "max_asset_exposure_pct": config.max_asset_exposure_pct,
        "hedge_drift_pct": config.hedge_drift_pct,
        "allowed_assets": list(config.allowed_assets),
        "allowed_protocols": list(config.allowed_protocols),
        "notes": (
            "Empty allowed_assets / allowed_protocols lists disable those filters. "
            "MAX_POSITION_USD in env overrides default when set positive."
        ),
    }
