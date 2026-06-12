"""Regression tests for Pydantic v2 JSONL event persistence."""

from __future__ import annotations

from datetime import datetime, timezone

from ameo_worker.services.event_store import AgentEvent, EventStore, EventType


def test_emit_and_get_cycle_events_roundtrip(tmp_path) -> None:
    store = EventStore(log_dir=str(tmp_path / "events"))
    store.emit(
        "cyc_parse_test",
        EventType.PLAN_GENERATED,
        {"action_type": "swap", "size_usd": 100},
        correlation_id="corr-1",
    )

    events = store.get_cycle_events("cyc_parse_test")
    assert len(events) == 1
    assert events[0].event_type == EventType.PLAN_GENERATED
    assert events[0].data["size_usd"] == 100
    assert events[0].correlation_id == "corr-1"


def test_read_all_parses_jsonl_lines(tmp_path) -> None:
    store = EventStore(log_dir=str(tmp_path / "events"))
    line = AgentEvent(
        event_id="evt_manual",
        cycle_id="cyc_manual",
        timestamp=datetime(2026, 6, 1, 12, 0, 0, tzinfo=timezone.utc),
        event_type=EventType.GUARDRAIL_EVALUATED,
        data={"violations": ["max_position_exceeded"]},
    ).model_dump_json()
    store.current_log_file.write_text(line + "\n", encoding="utf-8")

    events = store.read_all()
    assert len(events) == 1
    assert events[0].cycle_id == "cyc_manual"
    assert events[0].data["violations"] == ["max_position_exceeded"]
