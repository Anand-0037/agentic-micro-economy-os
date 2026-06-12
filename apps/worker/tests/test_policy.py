"""Unit tests for the deterministic policy engine (guardrail moat)."""

from __future__ import annotations

import pytest

from ameo_worker.models import ActionPlan
from ameo_worker.policy import PolicyConfig, PolicyEngine, policy_config_from_settings
from ameo_worker.services.guardrail_service import GuardrailService
from ameo_worker.settings import Settings


def _plan(
    *,
    action_type: str = "swap",
    size_usd: float | None = 100.0,
    protocol: str = "fusionx_v2",
    asset_in: str = "USDC",
    asset_out: str = "MNT",
) -> ActionPlan:
    return ActionPlan(
        action_type=action_type,
        protocol=protocol,
        asset_in=asset_in,
        asset_out=asset_out,
        size_usd=size_usd,
        action_params={"amount": size_usd or 0},
        rationale="test plan",
        rationale_summary="test",
        idempotency_key="test-idem",
        correlation_id="test-corr",
    )


@pytest.fixture
def engine() -> PolicyEngine:
    return PolicyEngine(
        PolicyConfig(
            max_drawdown_pct=0.12,
            max_position_usd=250.0,
            allowed_assets=["USDC", "MNT", "WMNT"],
            allowed_protocols=["fusionx_v2"],
        )
    )


def test_no_op_always_allowed(engine: PolicyEngine) -> None:
    plan = _plan(action_type="no_op", size_usd=None)
    assert engine.is_allowed(plan) is True
    assert engine.validate(plan) == []


def test_rejects_oversized_trade(engine: PolicyEngine) -> None:
    plan = _plan(size_usd=900.0)
    violations = engine.validate(plan)
    assert "max_position_exceeded" in violations
    assert engine.is_allowed(plan) is False


def test_rejects_drawdown_breach(engine: PolicyEngine) -> None:
    plan = _plan(size_usd=50.0)
    violations = engine.validate(plan, drawdown_pct=0.15)
    assert "drawdown_exceeded" in violations


def test_rejects_non_whitelisted_asset(engine: PolicyEngine) -> None:
    plan = _plan(asset_in="DOGE", asset_out="MNT")
    violations = engine.validate(plan)
    assert "asset_in_not_allowed" in violations


def test_rejects_non_whitelisted_protocol(engine: PolicyEngine) -> None:
    plan = _plan(protocol="unknown_dex")
    violations = engine.validate(plan)
    assert "protocol_not_allowed" in violations


def test_allows_policy_compliant_swap(engine: PolicyEngine) -> None:
    plan = _plan(size_usd=100.0)
    assert engine.is_allowed(plan, drawdown_pct=0.05) is True


def test_guardrail_service_blocks_degraded_observation() -> None:
    from ameo_worker.models import ObservationSnapshot

    config = PolicyConfig(max_position_usd=250.0, allowed_protocols=["fusionx_v2"])
    service = GuardrailService(config)
    plan = _plan(size_usd=10.0)
    observation = ObservationSnapshot(
        balances={"USDC": 1000.0},
        observation_quality=0.2,
        macro_signals={},
    )
    ok, violations = service.check_plan(plan, observation)
    assert ok is False
    assert "degraded_observation_quality" in violations


def test_policy_config_from_settings_uses_env_caps() -> None:
    settings = Settings(
        MAX_POSITION_USD=250,
        MAX_DRAWDOWN_PCT=0.12,
        ASSET_WHITELIST="USDC,MNT",
    )
    config = policy_config_from_settings(settings)
    assert config.max_position_usd == 250.0
    assert config.max_drawdown_pct == 0.12
    assert "USDC" in config.allowed_assets
