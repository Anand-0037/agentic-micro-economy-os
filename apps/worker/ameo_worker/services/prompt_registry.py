from __future__ import annotations

import json
from pathlib import Path

from ..settings import Settings


def _default_registry_path() -> Path:
    return (
        Path(__file__).resolve().parents[4] / "packages" / "prompts" / "registry.json"
    )


def load_prompt(prompt_id: str, settings: Settings) -> str:
    registry_path = (
        Path(settings.prompt_registry_path)
        if settings.prompt_registry_path
        else _default_registry_path()
    )
    registry = json.loads(registry_path.read_text())
    for entry in registry.get("prompts", []):
        if entry.get("id") == prompt_id:
            prompt_path = registry_path.parent / entry["path"]
            return prompt_path.read_text()

    raise ValueError(f"Prompt {prompt_id} not found in registry")
