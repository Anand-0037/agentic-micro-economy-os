from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field

ActionType = Literal[
    "swap",
    "lp_add",
    "lp_remove",
    "perps_open",
    "perps_close",
    "bundle",
    "no_op",
]


class ExecutionStep(BaseModel):
    action_type: ActionType
    asset_in: Optional[str] = None
    asset_out: Optional[str] = None
    size_usd: Optional[float] = None
    action_params: Dict[str, Any] = Field(default_factory=dict)


class ActionPlan(BaseModel):
    """A single actionable plan emitted by the planner."""

    schema_version: str = "1.0"
    action_type: ActionType
    protocol: Optional[str] = None
    asset_in: Optional[str] = None
    asset_out: Optional[str] = None
    size_usd: Optional[float] = None
    max_slippage_bps: Optional[int] = None
    rationale_summary: Optional[str] = None
    rationale: Optional[str] = None
    metadata_uri: Optional[str] = None
    steps: List[ExecutionStep] = Field(default_factory=list)
    action_params: Dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str
    correlation_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    planner: str = "rules@v0"
    cycle_id: Optional[str] = None


class ObservationSnapshot(BaseModel):
    """Normalized market and on-chain snapshot for planning."""

    balances: Dict[str, float] = Field(default_factory=dict)
    prices: Dict[str, float] = Field(default_factory=dict)
    pool_states: Dict[str, Any] = Field(default_factory=dict)
    macro_signals: Dict[str, Any] = Field(default_factory=dict)
    gas_price_wei: Optional[int] = None
    observation_quality: float = 1.0  # 0.0 to 1.0
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    sources: List[str] = Field(default_factory=list)


class ExecutionResult(BaseModel):
    ok: bool
    command: str
    dry_run: bool = False
    exit_code: Optional[int] = None
    tx_hash: Optional[str] = None
    raw_output: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None
    cycle_id: Optional[str] = None


class PolicyCheck(BaseModel):
    rule: str
    passed: bool
    reason: str


class CycleSummary(BaseModel):
    cycle_id: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    action_type: str
    status: str
    tx_hash: Optional[str] = None
    pnl_1e18: Optional[str] = None
    has_zero_g_receipt: bool = False


class CycleDetail(BaseModel):
    summary: CycleSummary
    observation: Dict[str, Any] = Field(default_factory=dict)
    treasury: Dict[str, Any] = Field(default_factory=dict)
    market_signal: Dict[str, Any] = Field(default_factory=dict)
    plan: Dict[str, Any] = Field(default_factory=dict)
    policy_checks: List[PolicyCheck] = Field(default_factory=list)
    policy_snapshot: Dict[str, Any] = Field(default_factory=dict)
    execution: Dict[str, Any] = Field(default_factory=dict)
    tx_hash: Dict[str, Any] = Field(default_factory=dict)
    decision_log: Optional[Dict[str, Any]] = None
    zero_g: Optional[Dict[str, Any]] = None
