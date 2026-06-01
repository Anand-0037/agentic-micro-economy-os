from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from ameo_worker.main import app
from ameo_worker.services import cycle_store
from ameo_worker.services.event_store import AgentEvent, EventType

client = TestClient(app)


def _write_fixture(
    tmp_path: Path, cycle_id: str = "cyc_test_fixture", *, append: bool = False
) -> None:
    log_dir = tmp_path / "events"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "events_20260521.jsonl"
    events = [
        AgentEvent(
            event_id="evt_1",
            cycle_id=cycle_id,
            timestamp=datetime(2026, 5, 21, 13, 24, 0),
            event_type=EventType.CYCLE_STARTED,
            data={"timestamp": "2026-05-21T13:24:00"},
        ),
        AgentEvent(
            event_id="evt_2",
            cycle_id=cycle_id,
            timestamp=datetime(2026, 5, 21, 13, 24, 1),
            event_type=EventType.OBSERVATION_COMPLETED,
            data={
                "quality": 1.0,
                "sources": ["mantle", "bybit"],
                "balances": {"MNT": 0.004101320406036965},
                "errors": [],
            },
        ),
        AgentEvent(
            event_id="evt_3",
            cycle_id=cycle_id,
            timestamp=datetime(2026, 5, 21, 13, 24, 5),
            event_type=EventType.PLAN_GENERATED,
            data={
                "action_type": "swap",
                "protocol": "merchant_moe",
                "rationale": "Rules fallback: tiny MNT→WMNT wrap under policy caps.",
                "planner": "rules@mantis-v1",
            },
            correlation_id="rules-29c5d5c5",
        ),
        AgentEvent(
            event_id="evt_4",
            cycle_id=cycle_id,
            timestamp=datetime(2026, 5, 21, 13, 24, 5, 100000),
            event_type=EventType.GUARDRAIL_EVALUATED,
            data={"ok": True, "violations": [], "action_type": "swap"},
            correlation_id="rules-29c5d5c5",
        ),
        AgentEvent(
            event_id="evt_5",
            cycle_id=cycle_id,
            timestamp=datetime(2026, 5, 21, 13, 24, 11),
            event_type=EventType.ACTION_EXECUTED,
            data={
                "ok": True,
                "tx_hash": "0x" + "a" * 64,  # placeholder - do not use the old removed hero tx
                "error": None,
            },
            correlation_id="rules-29c5d5c5",
        ),
        AgentEvent(
            event_id="evt_6",
            cycle_id=cycle_id,
            timestamp=datetime(2026, 5, 21, 13, 24, 14),
            event_type=EventType.CYCLE_COMPLETED,
            data={"ok": True, "violations": []},
        ),
    ]
    with log_file.open("a" if append else "w", encoding="utf-8") as handle:
        for event in events:
            handle.write(event.json() + "\n")


@pytest.fixture(autouse=True)
def reset_decision_cache() -> None:
    cycle_store.clear_cycle_cache()


def test_list_cycles_pagination(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cycle_store, "_EVENTS_DIR", tmp_path / "events")
    for idx in range(3):
        _write_fixture(tmp_path, cycle_id=f"cyc_page_{idx}", append=idx > 0)

    page, total = cycle_store.list_cycles(limit=2, offset=0)
    assert total == 3
    assert len(page) == 2

    page2, _ = cycle_store.list_cycles(limit=2, offset=2)
    assert len(page2) == 1


def test_get_cycle_by_id(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(cycle_store, "_EVENTS_DIR", tmp_path / "events")
    cycle_id = "cyc_detail_test"
    _write_fixture(tmp_path, cycle_id=cycle_id)

    detail = cycle_store.get_cycle(cycle_id)
    assert detail is not None
    assert detail.summary.cycle_id == cycle_id
    assert detail.summary.action_type == "swap"
    assert len(detail.policy_checks) >= 4
    assert detail.observation
    assert detail.treasury
    assert detail.market_signal
    assert detail.plan
    assert detail.execution
    assert detail.tx_hash


def test_api_cycles_route() -> None:
    response = client.get("/api/cycles")
    assert response.status_code == 200
    body = response.json()
    assert "cycles" in body
    assert "total" in body
    assert isinstance(body["cycles"], list)
    assert body["total"] >= 1


def test_api_cycle_detail_route() -> None:
    listing = client.get("/api/cycles").json()
    assert listing["cycles"]
    cycle_id = listing["cycles"][0]["cycle_id"]
    response = client.get(f"/api/cycles/{cycle_id}")
    assert response.status_code == 200
    body = response.json()
    assert len(body["policy_checks"]) >= 4
    assert body["observation"]
    assert body["treasury"]
    assert body["market_signal"]
    assert body["plan"]
    assert body["execution"]
    assert body["tx_hash"]
    assert body["summary"]["cycle_id"] == cycle_id
