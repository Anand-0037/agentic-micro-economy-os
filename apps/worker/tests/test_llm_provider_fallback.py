from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from ameo_worker.models import ActionPlan, ObservationSnapshot
from ameo_worker.services.event_store import EventStore, EventType
from ameo_worker.services.llm_provider import generate_plan, get_provider_chain_status
from ameo_worker.settings import Settings


@pytest.fixture
def base_settings() -> Settings:
    return Settings(
        MANTLE_RPC_URL="https://rpc.example.com",
        LLM_PROVIDER="z_ai",
        Z_AI_API_KEY="",
        GROQ_API_KEY="",
        GEMINI_API_KEY="",
        LIVE_ENABLED=False,
        WORKER_MODE="dry_run",
    )


@pytest.fixture
def observation() -> ObservationSnapshot:
    return ObservationSnapshot(
        balances={"MNT": 1.0},
        observation_quality=1.0,
        gas_price_wei=50_000_000_000,
    )


def test_generate_plan_falls_back_to_local_rules(
    base_settings: Settings,
    observation: ObservationSnapshot,
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events_dir = tmp_path / "events"
    events_dir.mkdir(parents=True, exist_ok=True)
    log_file = events_dir / "events_test.jsonl"

    original_init = EventStore.__init__

    def patched_init(self, log_dir: str = "logs/events") -> None:
        original_init(self, log_dir=str(events_dir))
        self.current_log_file = log_file

    monkeypatch.setattr(EventStore, "__init__", patched_init)

    plan = asyncio.run(
        generate_plan(
            observation,
            base_settings,
            allowed_assets=["MNT"],
            allowed_protocols=["merchant_moe"],
            lessons=[],
            cycle_id="cyc_fallback_test",
        )
    )

    assert isinstance(plan, ActionPlan)
    assert plan.planner.startswith("local_rules")
    events = EventStore().get_cycle_events("cyc_fallback_test")
    failed = [e for e in events if e.event_type == EventType.LLM_PROVIDER_FAILED]
    succeeded = [e for e in events if e.event_type == EventType.LLM_PROVIDER_SUCCEEDED]
    assert len(failed) == 3
    assert any(e.data.get("provider") == "local_rules" for e in succeeded)


def test_generate_plan_uses_groq_when_z_ai_fails(
    base_settings: Settings,
    observation: ObservationSnapshot,
) -> None:
    settings = base_settings.model_copy(
        update={"GROQ_API_KEY": "gsk_test", "GROQ_MODEL": "llama-3.3-70b-versatile"}
    )

    async def fake_run(llm, *args, **kwargs):
        return ActionPlan(
            action_type="no_op",
            idempotency_key="k1",
            correlation_id="c1",
            rationale="ok",
        )

    with patch(
        "ameo_worker.services.llm_provider.invoke_with_provider_errors",
        new_callable=AsyncMock,
    ) as invoke_mock:
        invoke_mock.side_effect = [
            RuntimeError("z.ai down"),
            ActionPlan(
                action_type="no_op",
                idempotency_key="k1",
                correlation_id="c1",
                rationale="ok",
                planner="groq@llama",
            ),
        ]
        with patch("ameo_worker.services.llm_reasoner._run_plan_chain", fake_run):
            plan = asyncio.run(
                generate_plan(
                    observation,
                    settings,
                    allowed_assets=["MNT"],
                    allowed_protocols=[],
                    lessons=[],
                    cycle_id="cyc_groq_test",
                )
            )

    assert plan.action_type == "no_op"
    status = get_provider_chain_status()
    assert status["active_provider"] in ("groq", "local_rules")
