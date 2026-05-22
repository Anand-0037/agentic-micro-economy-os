import os

import pytest


def pytest_configure() -> None:
    os.environ.setdefault("MANTLE_RPC_URL", "https://rpc.test")
    os.environ.setdefault("MEMORY_DB_PATH", "/tmp/ameo_pytest.db")


@pytest.fixture(autouse=True)
def clear_settings_cache() -> None:
    from ameo_worker.settings import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
