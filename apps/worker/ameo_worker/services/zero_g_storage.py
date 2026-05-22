from __future__ import annotations

import json
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

from ..settings import Settings

_ROOT_HASH_PATTERN = re.compile(
    r"root(?:\s*hash)?\s*[:=]\s*(0x[a-fA-F0-9]+)", re.IGNORECASE
)


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

    def upload_trace(self, payload: Dict[str, Any]) -> Optional[str]:
        if not self.is_configured():
            return None

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
                raise RuntimeError(
                    combined.strip() or "0G Storage CLI upload failed"
                )

            root_hash = parse_root_hash(combined)
            if not root_hash:
                raise RuntimeError(
                    "0G Storage CLI succeeded but no root hash was found in output"
                )
            return root_hash
        finally:
            if temp_path is not None:
                temp_path.unlink(missing_ok=True)
