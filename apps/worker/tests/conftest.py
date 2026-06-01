import os

import pytest


def pytest_configure() -> None:
    os.environ.setdefault("MANTLE_RPC_URL", "https://rpc.test")
    os.environ.setdefault("MEMORY_DB_PATH", "/tmp/ameo_pytest.db")
    os.environ.setdefault("WORKER_MODE", "dry_run")
    os.environ.setdefault("LIVE_ENABLED", "false")


@pytest.fixture(autouse=True)
def clear_settings_cache() -> None:
    from ameo_worker.context import get_worker_context
    from ameo_worker.settings import get_settings

    get_settings.cache_clear()
    get_worker_context.cache_clear()
    yield
    get_settings.cache_clear()
    get_worker_context.cache_clear()
