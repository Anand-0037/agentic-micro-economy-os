from __future__ import annotations

import os

from .settings import Settings


def enforce_production_llm_policy(settings: Settings) -> None:
    """Warn when primary LLM has no API key; chain fallback handles the rest."""
    _ = os.getenv("NODE_ENV", "").strip().lower()
    primary = (settings.llm_provider or "").strip().lower()
    if primary in ("z_ai", "zai", "z.ai") and not (settings.z_ai_api_key or "").strip():
        import logging

        logging.getLogger(__name__).warning(
            "LLM_PROVIDER=z_ai but Z_AI_API_KEY is empty; fallback chain will be used"
        )
