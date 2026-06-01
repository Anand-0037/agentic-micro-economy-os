"""TELEMETRY / QUOTE ONLY.

AMEO does NOT execute via Byreal Skills CLI.
All settlement happens in adapters/mantle_dex.py via the
FusionX V2 router (0x45e6f621c5ED8616cCFB9bBaeBAcF9638aBB0033)
on Mantle Sepolia.

This module fetches price quotes from Byreal's public quote API
(or a safe fallback) as ONE input to the planner's market-context signal.
It is strictly read-only telemetry. It never signs, never broadcasts,
never claims execution.

The actual on-chain swap (if policy approves) is performed by the
direct web3 adapter and logged via the AgentIdentity contract.
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Dict

import httpx

logger = logging.getLogger("ameo.byreal")

BYREAL_API_BASE = "https://api2.byreal.io"
BYREAL_SWAP_QUOTE_PATH = "/byreal/api/router/v1/router-service/swap"


@dataclass
class ByrealSkillResult:
    stdout: dict
    stderr: str
    exit_code: int
    latency_ms: int
    dry_run: bool


class ByrealSkillError(RuntimeError):
    """Raised when Byreal skill invocation fails (non-zero exit, timeout, or HTTP error)."""

    def __init__(self, message: str, *, stderr: str = "", exit_code: int | None = None) -> None:
        super().__init__(message)
        self.stderr = stderr
        self.exit_code = exit_code


def _emit_invocation_log(skill: str, exit_code: int, latency_ms: int) -> None:
    logger.info(
        "byreal_quote_fetched skill=%s exit=%s latency_ms=%s dry_run=true",
        skill,
        exit_code,
        latency_ms,
    )


def _parse_stdout(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if not text:
        return {}
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else {"value": parsed}
    except json.JSONDecodeError:
        return {"raw": text}


def invoke_skill(skill: str, params: dict[str, Any], timeout_s: float = 5.0) -> ByrealSkillResult:
    """TELEMETRY ONLY: Fetch a quote from Byreal's public API.
    Never executes on-chain. Never shells out to byreal-cli.
    Used purely as market-context input to the planner.
    """
    url = f"{BYREAL_API_BASE}{BYREAL_SWAP_QUOTE_PATH}"
    payload = {
        "inputMint": "So11111111111111111111111111111111111111112",
        "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "amount": "1000000",
        "swapMode": "in",
        "slippageBps": 50,
        "skillId": skill,
        "agentParams": params,
    }
    started = time.perf_counter()
    try:
        with httpx.Client(timeout=timeout_s) as client:
            response = client.post(url, json=payload)
    except httpx.TimeoutException as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        _emit_invocation_log(skill, -1, latency_ms)
        raise ByrealSkillError(
            f"Byreal quote timed out for {skill}",
            stderr=str(exc),
            exit_code=-1,
        ) from exc

    latency_ms = int((time.perf_counter() - started) * 1000)
    stderr = response.text if response.status_code >= 400 else ""
    exit_code = 0 if response.status_code < 400 else response.status_code
    stdout = _parse_stdout(response.text)
    stdout["transport"] = "http"
    stdout["skill"] = skill
    _emit_invocation_log(skill, exit_code, latency_ms)
    if exit_code != 0:
        raise ByrealSkillError(
            f"Byreal quote failed for {skill} (status={response.status_code})",
            stderr=stderr,
            exit_code=exit_code,
        )
    return ByrealSkillResult(
        stdout=stdout,
        stderr=stderr,
        exit_code=exit_code,
        latency_ms=latency_ms,
        dry_run=True,
    )
