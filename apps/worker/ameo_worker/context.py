from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from .services.memory_db import MemoryDB
from .services.onchain_logger import OnchainLogger
from .services.zero_g_storage import ZeroGStorageService
from .settings import Settings, get_settings


@dataclass
class WorkerContext:
    """Central service container for graph nodes and routes."""

    settings: Settings
    memory: MemoryDB
    zero_g: ZeroGStorageService
    onchain: OnchainLogger | None

    @classmethod
    def build(cls, settings: Settings | None = None) -> WorkerContext:
        s = settings or get_settings()
        onchain = (
            OnchainLogger(s)
            if s.agent_identity_address and s.agent_token_id >= 0
            else None
        )
        return cls(
            settings=s,
            memory=MemoryDB(s),
            zero_g=ZeroGStorageService(s),
            onchain=onchain,
        )


@lru_cache
def get_worker_context() -> WorkerContext:
    return WorkerContext.build()
