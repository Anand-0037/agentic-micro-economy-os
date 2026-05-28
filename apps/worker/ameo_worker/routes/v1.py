from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..agent import run_cycle
from ..policy import serialize_default_policy
from ..services.cycle_store import cycle_metadata, get_cycle, list_cycles
from ..services.decision_logs import fetch_decision_logs
from ..settings import get_settings

# TODO(post-submission): API-key auth for production deployments.

router = APIRouter(prefix="/v1", tags=["v1"])

POLICY_PREDICATES: list[dict[str, str]] = [
    {
        "id": "max_drawdown",
        "description": "Portfolio drawdown must stay within the configured cap.",
        "predicate": "drawdown_pct <= max_drawdown_pct",
    },
    {
        "id": "max_position",
        "description": "Single trade notional must not exceed MAX_POSITION_USD.",
        "predicate": "plan.size_usd <= max_position_usd",
    },
    {
        "id": "asset_whitelist",
        "description": "Both legs of a swap must be on the allowed asset list.",
        "predicate": "asset_in, asset_out in allowed_assets (when configured)",
    },
    {
        "id": "protocol_whitelist",
        "description": "Execution protocol must be on the allowed protocol list.",
        "predicate": "plan.protocol in allowed_protocols (when configured)",
    },
    {
        "id": "observation_quality",
        "description": "Degraded RPC or signal quality blocks autonomous action.",
        "predicate": "observation_quality > minimum threshold",
    },
    {
        "id": "balance_sufficiency",
        "description": "Treasury must hold enough of the input asset.",
        "predicate": "balance(asset_in) >= plan.size",
    },
    {
        "id": "gas_price_guard",
        "description": "Gas spikes above policy limits refuse execution.",
        "predicate": "gas_price_wei <= gas_price_cap",
    },
]

SKILLS = [
    {"id": "mantle.swap.v1", "executor": "byreal-cli", "version": "0.1.0"},
]


class ApiError(BaseModel):
    code: str
    message: str
    details: Optional[dict[str, Any]] = None


class DecisionInput(BaseModel):
    agentId: str
    action: dict[str, Any] = Field(default_factory=dict)
    rationale: str = ""


def _error_response(status: int, code: str, message: str, details: Any = None) -> JSONResponse:
    payload = {"error": ApiError(code=code, message=message, details=details).model_dump()}
    return JSONResponse(status_code=status, content=payload)


def _explorer_base(settings) -> str:
    base = (settings.mantle_explorer_base or "").strip()
    if base:
        return base.rstrip("/")
    if settings.mantle_chain_id == 5003:
        return "https://sepolia.mantlescan.xyz"
    return "https://mantlescan.xyz"


def _normalize_tx(tx_hash: str) -> str:
    text = tx_hash.strip().lower()
    return text if text.startswith("0x") else f"0x{text}"


@router.get("/skills")
async def list_skills() -> dict[str, Any]:
    """Registered Byreal Skills available to the worker."""
    return {"skills": SKILLS}


@router.get("/policies")
async def list_policies() -> dict[str, Any]:
    """Active policy predicates enforced before every cycle."""
    settings = get_settings()
    return {
        "policies": POLICY_PREDICATES,
        "env_caps": serialize_default_policy(settings),
    }


@router.post("/agents")
async def register_agent() -> dict[str, Any]:
    """Return the deployed ERC-8004 identity (testnet identity is pre-provisioned)."""
    settings = get_settings()
    if not settings.agent_identity_address:
        raise HTTPException(status_code=503, detail="agent_identity_not_configured")
    return {
        "agentId": settings.agent_identity_address,
        "tokenId": settings.agent_token_id,
        "ownerAddress": settings.agent_eoa or settings.treasury_eoa,
        "mintTxHash": None,
        "identityContract": settings.agent_identity_address,
    }


@router.get("/agents/{token_id}")
async def get_agent(token_id: int) -> dict[str, Any]:
    settings = get_settings()
    if token_id != settings.agent_token_id:
        raise HTTPException(status_code=404, detail="agent_not_found")
    logs = fetch_decision_logs(settings)
    return {
        "tokenId": settings.agent_token_id,
        "ownerAddress": settings.agent_eoa or settings.treasury_eoa,
        "identityContract": settings.agent_identity_address,
        "decisionCount": len(logs),
    }


@router.post("/decisions")
async def create_decision(body: DecisionInput, request: Request) -> dict[str, Any]:
    """Run a full observe → decide → policy → execute cycle."""
    settings = get_settings()
    if body.agentId and body.agentId not in {
        settings.agent_identity_address,
        str(settings.agent_token_id),
    }:
        return _error_response(400, "invalid_agent", "agentId does not match configured identity")

    try:
        result = await run_cycle()
    except Exception as exc:
        return _error_response(500, "cycle_failed", str(exc))

    cycle_id = result.get("cycle_id") or result.get("cycleId") or "unknown"
    detail = get_cycle(cycle_id)
    tx_hash = None
    rationale_hash = None
    zero_g_root = None
    policy_passed = True
    failed_rules: list[str] = []
    status = "PASS"

    if detail is not None:
        tx_hash = detail.tx_hash
        if detail.decision_log:
            rationale_hash = detail.decision_log.get("rationaleHash")
            zero_g_root = detail.decision_log.get("dataHash")
        for check in detail.policy_checks:
            if not check.passed:
                policy_passed = False
                failed_rules.append(check.rule)
        if detail.status in {"failed", "policy_rejected"}:
            status = "REFUSED"

    explorer = f"{_explorer_base(settings)}/tx/{tx_hash}" if tx_hash else None
    request.app.state.last_cycle_id = cycle_id
    return {
        "cycleId": cycle_id,
        "status": status,
        "rationaleHash": rationale_hash,
        "mantleTxHash": tx_hash,
        "mantlescanUrl": explorer,
        "zeroGReceiptRoot": zero_g_root,
        "policyResult": {"passed": policy_passed, "failedRules": failed_rules},
        "input": body.model_dump(),
    }


@router.post("/cycles/run")
async def run_cycle_v1(request: Request) -> dict[str, Any]:
    """Run one full observe → plan → policy → execute cycle."""
    try:
        result = await run_cycle()
    except Exception as exc:
        return _error_response(500, "cycle_failed", str(exc))

    cycle_id = result.get("cycle_id") or "unknown"
    request.app.state.last_cycle_id = cycle_id
    return {
        "cycleId": cycle_id,
        "status": "completed",
        "byrealSkillResult": result.get("byreal_skill_result"),
    }


@router.get("/decisions")
async def list_decisions(
    agentId: Optional[str] = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    cycles, total = list_cycles(limit=limit, offset=offset)
    items = []
    for cycle in cycles:
        items.append(
            {
                "cycleId": cycle.cycle_id,
                "status": cycle.status,
                "startedAt": cycle.started_at.isoformat() if cycle.started_at else None,
                "txHash": cycle.tx_hash,
                "agentId": agentId or get_settings().agent_identity_address,
                "metadata": cycle_metadata(cycle.cycle_id),
            }
        )
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/decisions/{cycle_id}")
async def get_decision(cycle_id: str) -> dict[str, Any]:
    detail = get_cycle(cycle_id)
    if detail is None:
        raise HTTPException(status_code=404, detail={"error": {"code": "not_found", "message": f"No cycle {cycle_id}"}})
    return detail.model_dump(mode="json")


@router.get("/verify/{tx_hash}")
async def verify_decision(tx_hash: str, request: Request) -> dict[str, Any]:
    """Judge-facing verification endpoint for a Mantle settlement transaction."""
    settings = get_settings()
    normalized = _normalize_tx(tx_hash)
    logs = fetch_decision_logs(settings)
    matched = next((log for log in logs if _normalize_tx(log.get("txHash", "")) == normalized), None)

    if not matched:
        return _error_response(404, "tx_not_indexed", f"No DecisionLogged for {normalized}")

    return {
        "txHash": normalized,
        "mantlescanUrl": f"{_explorer_base(settings)}/tx/{normalized}",
        "agentId": matched.get("agentId", str(settings.agent_token_id)),
        "rationaleHash": matched.get("rationaleHash"),
        "actionType": matched.get("actionType"),
        "decisionStatus": "PASS",
        "zeroGReceiptRoot": matched.get("dataHash") or None,
        "indexedAt": datetime.now(timezone.utc).isoformat(),
    }
