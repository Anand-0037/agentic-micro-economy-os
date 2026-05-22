from __future__ import annotations

from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class EventType(str, Enum):
    CYCLE_STARTED = "cycle_started"
    OBSERVATION_COMPLETED = "observation_completed"
    PLAN_GENERATED = "plan_generated"
    GUARDRAIL_EVALUATED = "guardrail_evaluated"
    ACTION_EXECUTED = "action_executed"
    ACTION_FAILED = "action_failed"
    CYCLE_COMPLETED = "cycle_completed"
    LLM_PROVIDER_FAILED = "llm_provider_failed"
    LLM_PROVIDER_SUCCEEDED = "llm_provider_succeeded"

class AgentEvent(BaseModel):
    event_id: str
    cycle_id: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    event_type: EventType
    data: Dict[str, Any]
    correlation_id: Optional[str] = None

class EventStore:
    """
    Append-only event store for deterministic runtime replay and observability.
    In a real system, this would be a database; here we use a structured JSONL log.
    """

    def __init__(self, log_dir: str = "logs/events") -> None:
        self.log_path = Path(log_dir)
        self.log_path.mkdir(parents=True, exist_ok=True)
        self.current_log_file = self.log_path / f"events_{datetime.utcnow().strftime('%Y%m%d')}.jsonl"

    def emit(self, cycle_id: str, event_type: EventType, data: Dict[str, Any], correlation_id: Optional[str] = None) -> AgentEvent:
        event = AgentEvent(
            event_id=f"evt_{datetime.utcnow().timestamp()}",
            cycle_id=cycle_id,
            event_type=event_type,
            data=data,
            correlation_id=correlation_id
        )
        
        # Append to JSONL
        with open(self.current_log_file, "a") as f:
            f.write(event.json() + "\n")
            
        return event

    def get_cycle_events(self, cycle_id: str) -> List[AgentEvent]:
        events = []
        if not self.current_log_file.exists():
            return events
            
        with open(self.current_log_file, "r") as f:
            for line in f:
                event = AgentEvent.parse_raw(line)
                if event.cycle_id == cycle_id:
                    events.append(event)
        return events
