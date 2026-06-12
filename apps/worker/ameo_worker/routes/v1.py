from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..agent import run_cycle
from ..identity_status import (
    effective_max_daily_volume_usd,
    inspect_identity_readiness,
    signing_eoa_from_settings,
)
from ..policy import policy_config_from_settings, serialize_default_policy
from ..services.cycle_store import cycle_metadata, get_cycle, list_cycles
from ..services.decision_logs import fetch_decision_logs
from ..services.event_store import EventStore, EventType
from ..settings import get_settings


async def verify_api_key(x_api_key: str | None = Header(default=None)) -> None:
    """FastAPI dependency for optional X-API-KEY auth on /v1/*.
    If API_KEY is set in env/settings, the header must match exactly.
    If not set (dev/local), requests are allowed (preserves current behavior).
    """
    settings = get_settings()
    if settings.api_key:
        if not x_api_key or x_api_key != settings.api_key:
            raise HTTPException(status_code=403, detail="Invalid or missing X-API-KEY")


# TODO(post-submission) addressed: API-key auth via dependency (enforced only when API_KEY configured).

router = APIRouter(prefix="/v1", tags=["v1"], dependencies=[Depends(verify_api_key)])

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
    {"id": "mantle.swap.v1", "executor": "mantle-dex-adapter", "version": "0.2.0"},
    {"id": "mantle.lp_add.v1", "executor": "mantle-dex-adapter (addLiquidity on FusionX)", "version": "0.3.0"},
    {"id": "mantle.perps_hedge.v1", "executor": "mantle-dex-adapter (synthetic hedge proxy; full Orderly pending)", "version": "0.3.0"},
]

GUARDRAILS: list[str] = [
    "MaxDrawdownCheck",
    "AssetWhitelistCheck",
    "TradeSizeCheck",
    "GasBudgetCheck",
    "MinimumBalanceCheck",
    "SlippageToleranceCheck",
    "ExecutionFrequencyCheck",
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
    """Registered execution skills available to the worker."""
    return {"skills": SKILLS}


@router.get("/policies")
async def list_policies() -> dict[str, Any]:
    """Active policy predicates enforced before every cycle."""
    settings = get_settings()
    return {
        "policies": POLICY_PREDICATES,
        "env_caps": serialize_default_policy(settings),
    }


@router.get("/config")
async def get_config() -> dict[str, Any]:
    """Single source of truth config for frontend policy UI (eliminates hardcoded drift).
    Values come from worker settings + policy engine (the actual enforcement source).
    """
    settings = get_settings()
    pc = policy_config_from_settings(settings)
    asset_whitelist = list(pc.allowed_assets) or ["USDC", "MNT"]
    llm_chain = [p.strip() for p in (settings.llm_provider_chain or "").split(",") if p.strip()]
    return {
        "guardrails": GUARDRAILS,
        "max_position_usd": pc.max_position_usd,
        "max_daily_volume_usd": effective_max_daily_volume_usd(settings),
        "signing_eoa": signing_eoa_from_settings(settings),
        "volatility_threshold_pct": settings.volatility_threshold_pct,
        "dex_slippage_bps": settings.dex_slippage_bps,
        "llm_provider_chain": llm_chain,
        "execution_adapter": settings.execution_adapter,
        "asset_whitelist": asset_whitelist,
        "max_drawdown_pct": pc.max_drawdown_pct,
        "allowed_protocols": list(pc.allowed_protocols),
    }


@router.get("/identity/status")
async def identity_status() -> dict[str, Any]:
    """Pre-flight: signing EOA must own AGENT_TOKEN_ID before DecisionLogged works."""
    settings = get_settings()
    payload = inspect_identity_readiness(settings)
    try:
        from ..context import get_worker_context

        ctx = get_worker_context()
        if ctx.onchain is not None:
            payload = inspect_identity_readiness(
                settings,
                w3=ctx.onchain._w3,
                contract=ctx.onchain._contract,
            )
    except Exception:
        pass
    return payload


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

    total_pnl = "0"
    capabilities = []
    token_uri = ""

    if settings.agent_identity_address:
        try:
            from ..clients.mantle import MantleClient
            from ..services.onchain_logger import _AGENT_IDENTITY_ABI
            mantle = MantleClient(settings)
            w3 = mantle.w3
            contract = w3.eth.contract(
                address=w3.to_checksum_address(settings.agent_identity_address),
                abi=_AGENT_IDENTITY_ABI,
            )
            profile = contract.functions.getAgentProfile(token_id).call()
            total_pnl = str(profile[2])
            last_cap = profile[5]
            if last_cap:
                capabilities = [last_cap]
            else:
                capabilities = []

            try:
                token_uri = contract.functions.tokenURI(token_id).call()
            except Exception:
                token_uri = f"https://docs.ameo.agiwithai.com/agents/{token_id}"
        except Exception:
            pass

    return {
        "tokenId": settings.agent_token_id,
        "ownerAddress": settings.agent_eoa or settings.treasury_eoa,
        "identityContract": settings.agent_identity_address,
        "decisionCount": len(logs),
        "totalPnL": total_pnl,
        "capabilities": capabilities,
        "tokenURI": token_uri,
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

    # 1. Look for on-chain DecisionLogged event
    logs = fetch_decision_logs(settings)
    matched = next((log for log in logs if _normalize_tx(log.get("txHash", "")) == normalized), None)

    # 2. Look for local execution evidence to get cycle_id and policy_results
    cycle_id = "unknown"
    detail = None
    try:
        events = EventStore().read_all()
        for ev in reversed(events):
            if ev.event_type == EventType.ACTION_EXECUTED:
                data = ev.data or {}
                if _normalize_tx(data.get("tx_hash", "")) == normalized:
                    cycle_id = ev.cycle_id
                    if cycle_id:
                        detail = get_cycle(cycle_id)
                    break
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("verify_fallback_event_read_failed tx=%s error=%s", normalized, exc)

    if not matched and not detail:
        return _error_response(
            404,
            "tx_not_indexed",
            f"No DecisionLogged and no local execution evidence for {normalized}. "
            "Either the tx never ran through this worker, or it is extremely old.",
        )

    # 3. Extract requested fields
    action_type = "unknown"
    if matched:
        action_type = matched.get("actionType") or action_type
    elif detail and detail.decision_log:
        action_type = detail.decision_log.get("actionType") or action_type

    rationale_hash = "unknown"
    if matched:
        rationale_hash = matched.get("rationaleHash") or rationale_hash
    elif detail and detail.decision_log:
        rationale_hash = detail.decision_log.get("rationaleHash") or rationale_hash

    raw_zero_g = None
    if matched:
        raw_zero_g = matched.get("metadataUri") or matched.get("dataHash")
    elif detail and detail.decision_log:
        raw_zero_g = detail.decision_log.get("dataHash") or detail.decision_log.get("metadataUri")

    policy_results = []
    if detail and detail.policy_checks:
        for check in detail.policy_checks:
            policy_results.append({
                "rule": check.rule,
                "passed": check.passed
            })

    response: dict[str, Any] = {
        "cycle_id": cycle_id,
        "action_type": action_type,
        "policy_results": policy_results,
        "rationale_hash": rationale_hash,
        "execution_tx_hash": normalized,
    }

    if raw_zero_g == "0g-upload-failed" or not raw_zero_g:
        response["zero_g_receipt"] = "Unavailable (upload timeout)"
    else:
        response["zero_g_root"] = raw_zero_g

    return response
