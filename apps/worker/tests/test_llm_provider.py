from ameo_worker.services.llm_provider import (
    GroqProvider,
    LlmProviderError,
    ZaiProvider,
    get_llm_provider,
)


def test_get_llm_provider_groq(monkeypatch) -> None:
    from ameo_worker.settings import Settings

    settings = Settings(
        MANTLE_RPC_URL="https://rpc.example.com",
        LLM_PROVIDER="groq",
        GROQ_API_KEY="gsk_test",
        GROQ_MODEL="llama-3.3-70b-versatile",
    )
    provider = get_llm_provider(settings)
    assert isinstance(provider, GroqProvider)
    assert provider.provider == "groq"
    assert provider.model == "llama-3.3-70b-versatile"


def test_get_llm_provider_z_ai(monkeypatch) -> None:
    from ameo_worker.settings import Settings

    settings = Settings(
        MANTLE_RPC_URL="https://rpc.example.com",
        LLM_PROVIDER="z_ai",
        Z_AI_API_KEY="key",
        Z_AI_MODEL="glm-5-turbo",
    )
    provider = get_llm_provider(settings)
    assert isinstance(provider, ZaiProvider)


def test_missing_groq_key_raises_structured_error() -> None:
    from ameo_worker.settings import Settings

    settings = Settings(
        MANTLE_RPC_URL="https://rpc.example.com",
        LLM_PROVIDER="groq",
        GROQ_API_KEY="",
    )
    try:
        get_llm_provider(settings)
        raise AssertionError("expected LlmProviderError")
    except LlmProviderError as exc:
        assert exc.provider == "groq"
        assert "GROQ_API_KEY" in str(exc)


def test_unsupported_provider() -> None:
    from ameo_worker.settings import Settings

    settings = Settings(
        MANTLE_RPC_URL="https://rpc.example.com",
        LLM_PROVIDER="unknown",
        GROQ_API_KEY="gsk_test",
    )
    try:
        get_llm_provider(settings)
        raise AssertionError("expected LlmProviderError")
    except LlmProviderError as exc:
        assert exc.provider == "unknown"
