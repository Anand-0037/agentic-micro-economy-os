from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..models import ActionPlan, ObservationSnapshot
from ..settings import Settings

_REPO_ROOT = Path(__file__).resolve().parents[4]


def _default_db_path() -> Path:
    return _REPO_ROOT / "data" / "ameo.db"


def _resolve_db_path(settings: Settings) -> Path:
    if settings.memory_db_path:
        db_path = Path(settings.memory_db_path)
        if not db_path.is_absolute():
            db_path = _REPO_ROOT / db_path
    else:
        db_path = _default_db_path()

    try:
        db_path.parent.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        fallback = _default_db_path()
        if db_path.resolve() == fallback.resolve():
            raise
        fallback.parent.mkdir(parents=True, exist_ok=True)
        return fallback
    return db_path


class MemoryDB:
    def __init__(self, settings: Settings) -> None:
        db_path = _resolve_db_path(settings)
        self._path = db_path
        self._conn = sqlite3.connect(self._path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init_db()

    def _init_db(self) -> None:
        cursor = self._conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS execution_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                action_plan TEXT NOT NULL,
                observation TEXT NOT NULL,
                pnl REAL NOT NULL,
                status TEXT NOT NULL
            )
            """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pnl_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                pnl REAL NOT NULL
            )
            """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_learnings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                lesson TEXT NOT NULL
            )
            """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS daily_notional (
                day TEXT PRIMARY KEY,
                notional_usd REAL NOT NULL DEFAULT 0.0
            )
            """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS plan_executions (
                plan_hash TEXT PRIMARY KEY,
                executed_at TEXT NOT NULL,
                cycle_id TEXT NOT NULL
            )
            """)
        self._conn.commit()

    def plan_executed_recently(self, plan_hash: str, within_minutes: int = 5) -> bool:
        cursor = self._conn.cursor()
        row = cursor.execute(
            "SELECT executed_at FROM plan_executions WHERE plan_hash = ?",
            (plan_hash,),
        ).fetchone()
        if not row:
            return False
        executed_at = datetime.fromisoformat(row["executed_at"])
        age_sec = (datetime.utcnow() - executed_at).total_seconds()
        return age_sec <= within_minutes * 60

    def record_plan_execution(self, plan_hash: str, cycle_id: str) -> None:
        cursor = self._conn.cursor()
        cursor.execute(
            """
            INSERT INTO plan_executions (plan_hash, executed_at, cycle_id)
            VALUES (?, ?, ?)
            ON CONFLICT(plan_hash) DO UPDATE SET
              executed_at = excluded.executed_at,
              cycle_id = excluded.cycle_id
            """,
            (plan_hash, datetime.utcnow().isoformat(), cycle_id),
        )
        self._conn.commit()

    def record_execution(
        self,
        plan: ActionPlan,
        observation: ObservationSnapshot,
        pnl: float,
        status: str,
    ) -> None:
        cursor = self._conn.cursor()
        cursor.execute(
            """
            INSERT INTO execution_history (created_at, action_plan, observation, pnl, status)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                datetime.utcnow().isoformat(),
                json.dumps(plan.model_dump(), default=str),
                json.dumps(observation.model_dump(), default=str),
                pnl,
                status,
            ),
        )
        cursor.execute(
            "INSERT INTO pnl_snapshots (created_at, pnl) VALUES (?, ?)",
            (datetime.utcnow().isoformat(), pnl),
        )
        self._conn.commit()

    def record_learning(self, lesson: str) -> None:
        cursor = self._conn.cursor()
        cursor.execute(
            "INSERT INTO agent_learnings (created_at, lesson) VALUES (?, ?)",
            (datetime.utcnow().isoformat(), lesson),
        )
        self._conn.commit()

    def recent_failures(self, limit: int = 5) -> List[str]:
        cursor = self._conn.cursor()
        rows = cursor.execute(
            """
            SELECT action_plan, pnl, created_at
            FROM execution_history
            WHERE pnl < 0
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

        lessons: List[str] = []
        for row in rows:
            plan = json.loads(row["action_plan"])
            lessons.append(
                f"{row['created_at']}: action={plan.get('action_type')} pnl={row['pnl']}"
            )
        return lessons

    def history(self, limit: int = 100) -> List[Dict[str, Any]]:
        cursor = self._conn.cursor()
        rows = cursor.execute(
            """
            SELECT created_at, pnl
            FROM pnl_snapshots
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows][::-1]

    def best_win(self) -> Optional[Dict[str, Any]]:
        cursor = self._conn.cursor()
        row = cursor.execute("""
            SELECT created_at, pnl, action_plan
            FROM execution_history
            ORDER BY pnl DESC
            LIMIT 1
            """).fetchone()
        if not row:
            return None
        plan = json.loads(row["action_plan"])
        return {
            "created_at": row["created_at"],
            "pnl": row["pnl"],
            "action_type": plan.get("action_type"),
        }

    def learnings(self, limit: int = 5) -> List[Dict[str, Any]]:
        cursor = self._conn.cursor()
        rows = cursor.execute(
            """
            SELECT created_at, lesson
            FROM agent_learnings
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]

    def performance(self) -> Dict[str, Any]:
        history = self.history(limit=200)
        if not history:
            return {"sharpe": 0.0, "drawdown": 0.0}

        pnl_values = [row["pnl"] for row in history]
        avg = sum(pnl_values) / len(pnl_values)
        variance = sum((x - avg) ** 2 for x in pnl_values) / len(pnl_values)
        std = variance**0.5
        sharpe = avg / std if std > 0 else 0.0

        peak = pnl_values[0]
        max_drawdown = 0.0
        cumulative = 0.0
        for pnl in pnl_values:
            cumulative += pnl
            if cumulative > peak:
                peak = cumulative
            drawdown = peak - cumulative
            if drawdown > max_drawdown:
                max_drawdown = drawdown

        return {"sharpe": sharpe, "drawdown": max_drawdown}

    def daily_notional_today(self) -> float:
        day = datetime.utcnow().strftime("%Y-%m-%d")
        cursor = self._conn.cursor()
        row = cursor.execute(
            "SELECT notional_usd FROM daily_notional WHERE day = ?", (day,)
        ).fetchone()
        if not row:
            return 0.0
        return float(row["notional_usd"])

    def add_notional_usd(self, amount: float) -> None:
        if amount <= 0:
            return
        day = datetime.utcnow().strftime("%Y-%m-%d")
        cursor = self._conn.cursor()
        cursor.execute(
            """
            INSERT INTO daily_notional (day, notional_usd) VALUES (?, ?)
            ON CONFLICT(day) DO UPDATE SET
              notional_usd = daily_notional.notional_usd + excluded.notional_usd
            """,
            (day, amount),
        )
        self._conn.commit()
