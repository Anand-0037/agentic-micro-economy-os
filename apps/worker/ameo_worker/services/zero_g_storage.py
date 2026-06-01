from __future__ import annotations

import json
import logging
import re
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

from ..settings import Settings

logger = logging.getLogger("ameo.zero_g")

_ROOT_HASH_PATTERN = re.compile(
    r"(?:root(?:\s*hash)?|merkle root calculated.*?root)\s*[:=]\s*(0x[a-fA-F0-9]+)",
    re.IGNORECASE | re.DOTALL,
)


def _zero_g_failure_reason(output: str) -> str:
    text = output.lower()
    if "insufficient funds" in text:
        return "ZERO_G wallet needs Galileo testnet gas to submit storage log entries"
    if "not configured" in text:
        return "0G Storage environment is incomplete"
    return output.strip()[:200] or "0G Storage CLI upload failed"


@dataclass
class ZeroGAnchorResult:
    root_hash: str | None
    indexer_url: str | None
    anchored: bool


def parse_root_hash(output: str) -> Optional[str]:
    match = _ROOT_HASH_PATTERN.search(output)
    if match:
        return match.group(1)
    return None


class ZeroGStorageService:
    """Upload cycle traces via the official 0G Storage CLI (wallet auth, not API keys)."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def is_configured(self) -> bool:
        key = self._settings.zero_g_private_key
        return bool(
            self._settings.zero_g_rpc_url
            and self._settings.zero_g_indexer_url
            and key
            and self._settings.zero_g_cli_path
        )

    @staticmethod
    def _normalize_key(key: str) -> str:
        return key if key.startswith("0x") else f"0x{key}"

    def anchor_trace(
        self, payload: Dict[str, Any], cycle_id: str = "unknown"
    ) -> ZeroGAnchorResult:
        try:
            if not self.is_configured():
                raise RuntimeError("0G Storage not configured")

            temp_path: Path | None = None
            try:
                with tempfile.NamedTemporaryFile(
                    mode="w", suffix=".json", delete=False, encoding="utf-8"
                ) as handle:
                    json.dump(payload, handle, ensure_ascii=False)
                    temp_path = Path(handle.name)

                cmd = [
                    self._settings.zero_g_cli_path,
                    "upload",
                    "--url",
                    self._settings.zero_g_rpc_url,
                    "--key",
                    self._normalize_key(self._settings.zero_g_private_key),
                    "--indexer",
                    self._settings.zero_g_indexer_url,
                    "--file",
                    str(temp_path),
                ]

                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=self._settings.zero_g_timeout_sec,
                    check=False,
                )
                combined = f"{result.stdout}\n{result.stderr}"
                if result.returncode != 0:
                    stderr = (result.stderr or "").strip()
                    stdout = (result.stdout or "").strip()
                    logger.error(
                        "zero_g_cli_failed cycle=%s rc=%s stderr=%s stdout=%s",
                        cycle_id,
                        result.returncode,
                        stderr[:500],
                        stdout[:200],
                    )
                    raise RuntimeError(_zero_g_failure_reason(f"{stdout}\n{stderr}"))

                root_hash = parse_root_hash(combined)
                if not root_hash:
                    raise RuntimeError(
                        "0G Storage CLI succeeded but no root hash was found in output"
                    )

                indexer_url = self._settings.zero_g_indexer_url
                logger.info(
                    "zero_g_anchor_succeeded cycle=%s root_hash=%s",
                    cycle_id,
                    root_hash,
                )
                return ZeroGAnchorResult(
                    root_hash=root_hash,
                    indexer_url=indexer_url,
                    anchored=True,
                )
            finally:
                if temp_path is not None:
                    temp_path.unlink(missing_ok=True)
        except subprocess.TimeoutExpired as exc:
            stderr = (exc.stderr or "").strip() if isinstance(exc.stderr, str) else ""
            logger.error(
                "zero_g_cli_timeout cycle=%s stderr=%s",
                cycle_id,
                stderr[:500],
            )
            return ZeroGAnchorResult(root_hash=None, indexer_url=None, anchored=False)
        except Exception as exc:
            http_status = getattr(exc, "status", None) or getattr(exc, "status_code", None)
            logger.warning(
                "[WARN] zero_g_anchor_failed cycle=%s error_class=%s http_status=%s msg=%s",
                cycle_id,
                type(exc).__name__,
                http_status,
                str(exc)[:200],
            )
            return ZeroGAnchorResult(root_hash=None, indexer_url=None, anchored=False)

    def upload_trace(self, payload: Dict[str, Any], cycle_id: str = "unknown") -> Optional[str]:
        """Backward-compatible helper returning only the root hash when anchored."""
        try:
            anchor = self.anchor_trace(payload, cycle_id=cycle_id)
        except Exception:
            return None
        return anchor.root_hash if anchor.anchored else None
