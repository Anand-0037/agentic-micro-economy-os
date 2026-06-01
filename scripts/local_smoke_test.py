#!/usr/bin/env python3
"""
Local smoke tests for AMEO core logic (no keys / RPC required for these paths).

Run with:
  cd apps/worker
  uv run python ../../scripts/local_smoke_test.py
"""

import sys
from pathlib import Path

# Add worker to path
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "worker"))

from ameo_worker.models import ActionPlan, ObservationSnapshot
from ameo_worker.policy import PolicyEngine, policy_config_from_settings
from ameo_worker.services.rules_planner import build_rules_action_plan
from ameo_worker.services.delta_neutral_planner import build_delta_neutral_plan
from ameo_worker.settings import Settings

# Minimal settings for testing (no real keys needed)
class FakeSettings(Settings):
    model_config = {"extra": "ignore"}
    agent_private_key: str = "0x" + "0" * 64
    agent_identity_address: str = "0x" + "1" * 40
    agent_token_id: int = 0
    live_enabled: bool = False
    max_daily_volume_usd: float = 100.0
    volatility_threshold_pct: float = 5.0

def test_rules_planner():
    print("Testing rules planner (fallback when LLMs fail)...")
    settings = FakeSettings()
    obs = ObservationSnapshot(balances={"MNT": 0.5}, gas_price_wei=1_000_000_000, observation_quality=1.0)
    
    plan = build_rules_action_plan(obs, settings)
    assert plan.action_type == "swap"
    assert "micro" in plan.rationale.lower() or "policy" in plan.rationale.lower()
    print("  ✓ Rules planner produces a safe micro-swap plan")

def test_delta_neutral_disabled():
    print("Testing delta-neutral planner (should be disabled)...")
    settings = FakeSettings()
    obs = ObservationSnapshot(balances={"MNT": 10, "USDC": 100}, macro_signals={"tickers": {"MNTUSDT": {"price_change_pct": 12}}})
    
    plan = build_delta_neutral_plan(obs, settings)
    assert plan is None, "Delta-neutral should return None until LP/perps are supported"
    print("  ✓ Delta-neutral correctly returns None (no unsupported actions)")

def test_policy_engine():
    print("Testing policy engine...")
    settings = FakeSettings()
    pc = policy_config_from_settings(settings)
    engine = PolicyEngine(pc)
    
    # Small safe plan should pass
    safe_plan = ActionPlan(
        action_type="swap", 
        asset_in="MNT", 
        asset_out="WMNT", 
        size_usd=0.01,
        idempotency_key="test-safe",
        correlation_id="test-safe"
    )
    violations = engine.validate(safe_plan)
    assert len(violations) == 0
    print("  ✓ Small safe plan passes policy (no violations)")

    # Oversized plan should be blocked
    big_plan = ActionPlan(
        action_type="swap", 
        asset_in="MNT", 
        asset_out="WMNT", 
        size_usd=9999,
        idempotency_key="test-big",
        correlation_id="test-big"
    )
    violations2 = engine.validate(big_plan)
    assert len(violations2) > 0
    print("  ✓ Oversized plan is correctly blocked by policy")

def main():
    print("=" * 60)
    print("AMEO LOCAL SMOKE TESTS (pure Python logic, no network/keys)")
    print("=" * 60)
    
    try:
        test_rules_planner()
        test_delta_neutral_disabled()
        test_policy_engine()
        print("\n✅ All smoke tests PASSED")
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ UNEXPECTED ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()