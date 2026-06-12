from ameo_worker.bootstrap import enforce_production_llm_policy
from ameo_worker.settings import Settings


def test_production_allows_provider_chain_without_zai() -> None:
    settings = Settings(
        MANTLE_RPC_URL="https://rpc.example.com",
        LLM_PROVIDER="groq",
        GROQ_API_KEY="x",
        LLM_PROVIDER_CHAIN="groq,z_ai,gemini,local_rules",
    )
    import os

    old = os.environ.get("NODE_ENV")
    os.environ["NODE_ENV"] = "production"
    try:
        enforce_production_llm_policy(settings)
    finally:
        if old is None:
            os.environ.pop("NODE_ENV", None)
        else:
            os.environ["NODE_ENV"] = old


def test_production_allows_zai() -> None:
    settings = Settings(
        MANTLE_RPC_URL="https://rpc.example.com",
        LLM_PROVIDER="z_ai",
        Z_AI_API_KEY="x",
    )
    import os

    old = os.environ.get("NODE_ENV")
    os.environ["NODE_ENV"] = "production"
    try:
        enforce_production_llm_policy(settings)
    finally:
        if old is None:
            os.environ.pop("NODE_ENV", None)
        else:
            os.environ["NODE_ENV"] = old
