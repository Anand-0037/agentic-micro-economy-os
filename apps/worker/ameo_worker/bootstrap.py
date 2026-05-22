from __future__ import annotations

import os

from .settings import Settings


def enforce_production_llm_policy(settings: Settings) -> None:
    """Production must use sponsor LLM (Z.ai) — no silent fallback."""
    node_env = os.getenv("NODE_ENV", "").strip().lower()
    provider = (settings.llm_provider or "").strip().lower()
    if node_env == "production" and provider not in ("z_ai", "zai", "z.ai"):
        raise RuntimeError(
            f"Production requires LLM_PROVIDER=z_ai (got {settings.llm_provider!r})"
        )
