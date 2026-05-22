from __future__ import annotations

import logging
from typing import List, Tuple

from ..models import ActionPlan, ObservationSnapshot
from ..policy import PolicyConfig, PolicyEngine

logger = logging.getLogger(__name__)

class GuardrailService:
    """
    The Execution Safety and Policy Enforcement layer.
    Ensures that every action planned by the agent conforms to institutional-grade safety standards.
    """

    def __init__(self, config: PolicyConfig) -> None:
        self.engine = PolicyEngine(config)
        self.config = config

    def check_plan(
        self, plan: ActionPlan, observation: ObservationSnapshot
    ) -> Tuple[bool, List[str]]:
        """
        Comprehensive check of an action plan against market state and policies.
        Returns (is_ok, violations).
        """
        violations: List[str] = []

        # 1. Base Policy Engine Validation
        drawdown_pct = observation.macro_signals.get("drawdown_pct") if isinstance(observation.macro_signals, dict) else None
        engine_violations = self.engine.validate(plan, drawdown_pct=drawdown_pct)
        violations.extend(engine_violations)

        # 2. Observation Quality Check
        # If quality is too low, only allow no_op or emergency exits (if implemented)
        if observation.observation_quality < 0.5 and plan.action_type != "no_op":
            violations.append("degraded_observation_quality")

        # 3. Liquidity/Balance Checks (Extended)
        if plan.action_type != "no_op":
            # Check balance for asset_in
            if plan.asset_in:
                amount_needed = plan.action_params.get("amount", plan.size_usd or 0)
                current_balance = observation.balances.get(plan.asset_in, 0)
                if amount_needed > current_balance:
                    violations.append(f"insufficient_balance:{plan.asset_in}")

        # 4. Gas Price Guardrail
        # If gas is extremely high (e.g. > 500 Gwei), block non-emergency actions
        # (Assuming gas_price_wei is available)
        if observation.gas_price_wei and observation.gas_price_wei > 500 * 10**9:
             if plan.action_type not in ["no_op"]:
                 violations.append("gas_price_spike_blocked")

        # 5. Protocol Whitelisting
        if self.config.allowed_protocols and plan.protocol:
            if plan.protocol not in self.config.allowed_protocols:
                violations.append(f"unauthorized_protocol:{plan.protocol}")

        is_ok = len(violations) == 0
        return is_ok, violations
