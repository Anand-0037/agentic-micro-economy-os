from __future__ import annotations

import json
import logging
import subprocess
import time
from dataclasses import dataclass
from typing import Any, Dict

import httpx

logger = logging.getLogger("ameo.byreal")

BYREAL_CLI = "byreal-cli"
BYREAL_CLI_VERSION = "0.3.6"
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


def _flag_pairs(params: dict[str, Any]) -> list[str]:
    flags: list[str] = []
    for key, value in params.items():
        flags.extend([f"--{str(key).replace('_', '-')}", str(value)])
    return flags


def _emit_invocation_log(skill: str, exit_code: int, latency_ms: int) -> None:
    logger.info(
        "byreal_skill_invoked skill=%s exit=%s latency_ms=%s dry_run=true",
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


def _invoke_skill_http(skill: str, params: dict[str, Any], timeout_s: float) -> ByrealSkillResult:
    """Real HTTP quote probe when the byreal-cli binary is unavailable."""
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
    with httpx.Client(timeout=timeout_s) as client:
        response = client.post(url, json=payload)
    latency_ms = int((time.perf_counter() - started) * 1000)
    stderr = response.text if response.status_code >= 400 else ""
    exit_code = 0 if response.status_code < 400 else response.status_code
    stdout = _parse_stdout(response.text)
    stdout["transport"] = "http"
    stdout["skill"] = skill
    _emit_invocation_log(skill, exit_code, latency_ms)
    if exit_code != 0:
        raise ByrealSkillError(
            f"Byreal HTTP quote failed for {skill} (status={response.status_code})",
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


def invoke_skill(skill: str, params: dict[str, Any], timeout_s: float = 5.0) -> ByrealSkillResult:
    """Invoke a Byreal skill via byreal-cli (dry-run JSON). Falls back to HTTP quote probe."""
    flag_args = _flag_pairs(params)
    started = time.perf_counter()
    try:
        completed = subprocess.run(["byreal-cli", skill, "--dry-run", "--json", *flag_args], capture_output=True, text=True, timeout=timeout_s, check=False)
    except subprocess.TimeoutExpired as exc:
        latency_ms = int((time.perf_counter() - started) * 1000)
        _emit_invocation_log(skill, -1, latency_ms)
        raise ByrealSkillError(
            f"Byreal skill {skill} timed out after {timeout_s}s",
            stderr=str(exc),
            exit_code=-1,
        ) from exc
    except FileNotFoundError:
        return _invoke_skill_http(skill, params, timeout_s)

    latency_ms = int((time.perf_counter() - started) * 1000)
    stderr = completed.stderr or ""
    exit_code = completed.returncode
    _emit_invocation_log(skill, exit_code, latency_ms)
    if exit_code != 0:
        raise ByrealSkillError(
            f"Byreal skill {skill} exited with code {exit_code}",
            stderr=stderr,
            exit_code=exit_code,
        )
    return ByrealSkillResult(
        stdout=_parse_stdout(completed.stdout),
        stderr=stderr,
        exit_code=exit_code,
        latency_ms=latency_ms,
        dry_run=True,
    )
