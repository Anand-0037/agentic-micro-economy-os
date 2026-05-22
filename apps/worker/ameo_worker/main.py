from __future__ import annotations

import asyncio
import glob
import json
import os
import random
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

import sentry_sdk
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .adapters.mantle_dex import MantleDexAdapter
from .clients.mantle import MantleClient
from .agent import run_cycle
from .bootstrap import enforce_production_llm_policy
from .policy import serialize_default_policy
from .sentry_setup import init_sentry
from .services.cycle_store import get_cycle, list_cycles
from .services.decision_logs import fetch_decision_logs
from .services.llm_provider import LlmProviderError, get_llm_provider, get_provider_chain_status
from .services.zero_g_storage import ZeroGStorageService
from .services.memory_db import MemoryDB
from .settings import get_settings
from .state import get_status

app = FastAPI(title="AMEO Worker", version="0.1.0")

_settings = get_settings()
enforce_production_llm_policy(_settings)
init_sentry(_settings.sentry_dsn)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Runner:
    def __init__(self) -> None:
        self._task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()
        self._running = False
        self._started_at: Optional[datetime] = None
        self._last_cycle_at: Optional[datetime] = None
        self._cycles_completed = 0
        self._last_error: Optional[str] = None

    @property
    def running(self) -> bool:
        return self._running

    def status(self) -> dict:
        active_for_seconds = 0
        if self._running and self._started_at:
            active_for_seconds = int(
                (datetime.utcnow() - self._started_at).total_seconds()
            )
        return {
            "running": self._running,
            "started_at": self._started_at.isoformat() if self._started_at else None,
            "last_cycle_at": (
                self._last_cycle_at.isoformat() if self._last_cycle_at else None
            ),
            "cycles_completed": self._cycles_completed,
            "active_for_seconds": active_for_seconds,
            "last_error": self._last_error,
        }

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._started_at = datetime.utcnow()
        self._last_error = None
        self._stop_event.clear()
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if not self._running:
            return
        self._running = False
        self._stop_event.set()
        if self._task:
            await self._task

    async def _loop(self) -> None:
        settings = get_settings()
        interval = settings.agent_interval_sec
        while not self._stop_event.is_set():
            try:
                await run_cycle()
                self._last_error = None
            except Exception as exc:
                self._last_error = str(exc)
                MemoryDB(settings).record_learning(f"Critical failure in runner: {exc}")
            self._cycles_completed += 1
            self._last_cycle_at = datetime.utcnow()
            jitter = random.uniform(0, interval * 0.2)
            try:
                await asyncio.wait_for(
                    self._stop_event.wait(), timeout=interval + jitter
                )
            except asyncio.TimeoutError:
                continue


runner = Runner()


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.get("/diagnostics/llm")
async def diagnostics_llm() -> dict:
    """One-token LLM ping for the configured provider (no silent fallback)."""
    settings = get_settings()
    chain = get_provider_chain_status()
    try:
        provider = get_llm_provider(settings)
    except LlmProviderError as exc:
        return {"ok": False, "error": exc.to_dict(), **chain}
    result = await provider.ping()
    return {**result, **chain}


@app.get("/api/llm-chain")
async def api_llm_chain() -> dict:
    return get_provider_chain_status()


@app.get("/status")
async def status() -> dict:
    return get_status()


@app.get("/api/status")
async def api_status() -> dict:
    return get_status()


@app.get("/api/history")
async def history() -> dict:
    db = MemoryDB(get_settings())
    return {
        "history": db.history(),
        "learnings": db.learnings(),
        "best_win": db.best_win(),
    }


@app.get("/api/performance")
async def performance() -> dict:
    db = MemoryDB(get_settings())
    return db.performance()


@app.get("/api/runner")
async def runner_status() -> dict:
    return runner.status()


@app.get("/api/trophy")
async def trophy() -> dict:
    db = MemoryDB(get_settings())
    learnings = db.learnings(limit=1)
    return {
        "best_win": db.best_win(),
        "highlight_lesson": learnings[0] if learnings else None,
    }


@app.post("/api/start")
async def start_runner() -> dict:
    await runner.start()
    return {"running": runner.running}


@app.post("/api/stop")
async def stop_runner() -> dict:
    await runner.stop()
    return {"running": runner.running}


@app.post("/run-cycle")
async def run_cycle_endpoint() -> dict:
    return await run_cycle()


@app.get("/api/policy")
async def api_policy() -> dict[str, Any]:
    return serialize_default_policy(get_settings())


@app.get("/api/public-config")
async def api_public_config() -> dict[str, Any]:
    s = get_settings()
    netloc = urlparse(s.mantle_rpc_url).netloc or s.mantle_rpc_url
    db = MemoryDB(s)
    return {
        "mantle_chain_id": s.mantle_chain_id,
        "mantle_rpc_netloc": netloc,
        "treasury_eoa": s.treasury_eoa,
        "agent_identity_address": s.agent_identity_address,
        "agent_token_id": s.agent_token_id,
        "agent_interval_sec": s.agent_interval_sec,
        "execution_adapter": s.execution_adapter,
        "memory_db_path": s.memory_db_path,
        "live_enabled": s.live_enabled,
        "worker_mode": s.worker_mode,
        "max_daily_volume_usd": s.max_daily_volume_usd,
        "max_position_usd": s.max_position_usd,
        "prompt_set_version": s.prompt_set_version,
        "allows_live_execution": s.allows_live_execution(),
        "daily_notional_usd_today": db.daily_notional_today(),
    }


@app.get("/api/dex-probe")
async def api_dex_probe() -> dict[str, Any]:
    """Run Mantle DEX adapter readiness probes (safe, read-only)."""
    return MantleDexAdapter(get_settings()).probe_dex()


@app.get("/api/mantle-probe")
async def api_mantle_probe() -> dict[str, Any]:
    """Verify Mantle RPC from the worker (server-side; avoids browser CORS)."""
    settings = get_settings()
    try:
        client = MantleClient(settings)
        block = client.w3.eth.block_number
        return {
            "ok": True,
            "chain_id": client.w3.eth.chain_id,
            "block_number": block,
            "rpc": client.active_rpc,
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


@app.get("/api/cycles")
async def api_cycles(limit: int = 50, offset: int = 0) -> dict[str, Any]:
    cycles, total = list_cycles(limit=limit, offset=offset)
    return {
        "cycles": [cycle.model_dump(mode="json") for cycle in cycles],
        "total": total,
    }


@app.get("/api/cycles/{cycle_id}")
async def api_cycle_detail(cycle_id: str) -> dict[str, Any]:
    detail = get_cycle(cycle_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="cycle_not_found")
    return detail.model_dump(mode="json")


@app.get("/api/events/tail")
async def events_tail(limit: int = 200):
    """Stream the last N JSONL events from logs/events/events_*.jsonl as SSE."""

    def latest_file() -> str | None:
        files = sorted(glob.glob("logs/events/events_*.jsonl"))
        return files[-1] if files else None

    async def gen():
        f = latest_file()
        if not f:
            yield 'data: {"type":"idle","msg":"Worker idle — waiting for next cycle."}\n\n'
            return

        with open(f, encoding="utf-8") as fh:
            lines = fh.readlines()[-limit:]
            for line in lines:
                if line.strip():
                    yield f"data: {line.strip()}\n\n"
            fh.seek(0, os.SEEK_END)
            while True:
                line = fh.readline()
                if line:
                    if line.strip():
                        yield f"data: {line.strip()}\n\n"
                else:
                    await asyncio.sleep(0.5)

    return StreamingResponse(gen(), media_type="text/event-stream")


@app.get("/api/decisions")
async def api_decisions(from_block: int = 0) -> dict[str, Any]:
    """Return on-chain DecisionLogged events via the Python Mantle client."""
    settings = get_settings()
    if not settings.agent_identity_address:
        return {"logs": [], "error": "agent_identity_not_configured"}
    try:
        logs = fetch_decision_logs(settings, from_block=from_block)
        client = MantleClient(settings)
        return {
            "logs": logs,
            "count": len(logs),
            "rpc": client.active_rpc,
            "chain_id": settings.mantle_chain_id,
        }
    except Exception as exc:
        return {"logs": [], "error": str(exc)}


@app.get("/api/zero-g-probe")
async def api_zero_g_probe() -> dict[str, Any]:
    """Verify 0G Storage CLI configuration (uploads a tiny probe JSON)."""
    settings = get_settings()
    service = ZeroGStorageService(settings)
    if not service.is_configured():
        return {
            "configured": False,
            "message": "Set ZERO_G_RPC_URL, ZERO_G_INDEXER_URL, ZERO_G_PRIVATE_KEY, ZERO_G_CLI_PATH",
        }
    try:
        root_hash = service.upload_trace(
            {
                "probe": "ameo-zero-g",
                "ts": datetime.utcnow().isoformat() + "Z",
            }
        )
        return {
            "configured": True,
            "ok": bool(root_hash),
            "root_hash": root_hash,
            "indexer": settings.zero_g_indexer_url,
            "rpc": settings.zero_g_rpc_url,
        }
    except Exception as exc:
        return {"configured": True, "ok": False, "error": str(exc)}


@app.get("/api/eval-report")
async def api_eval_report() -> dict[str, Any]:
    s = get_settings()
    raw = (s.eval_report_path or "").strip()
    if raw:
        path = Path(raw).expanduser().resolve()
    else:
        path = (Path(__file__).resolve().parent.parent / "eval_report.json").resolve()
    if not path.is_file():
        return {
            "available": False,
            "message": (
                "No eval report found. Set EVAL_REPORT_PATH or add "
                "apps/worker/eval_report.json."
            ),
        }
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {"available": False, "message": f"Could not read eval report: {exc}"}
    return {"available": True, "path": str(path), "report": data}


@app.get("/sentry-debug")
async def trigger_error() -> dict[str, Any]:
    """Verify worker Sentry — triggers a test exception."""
    raise RuntimeError("AMEO Sentry worker test — delete me")
