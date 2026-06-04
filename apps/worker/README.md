# AMEO Worker

FastAPI async worker with a LangGraph state machine.

## Run

```bash
uv sync
uv run uvicorn ameo_worker.main:app --reload
```

## Structure

- ameo_worker/models.py: Pydantic models
- ameo_worker/policy.py: PolicyEngine (drawdown, exposure, and whitelist checks)
- ameo_worker/graph.py: LangGraph wiring
- ameo_worker/agent.py: run_cycle entry
