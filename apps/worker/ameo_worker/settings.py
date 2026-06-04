from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_REPO_ROOT / ".env"),
        env_prefix="",
        extra="ignore",
    )

    mantle_rpc_url: str = Field(
        "https://rpc.sepolia.mantle.xyz", alias="MANTLE_RPC_URL"
    )
    mantle_rpc_url_fallback: str = Field("", alias="MANTLE_RPC_URL_FALLBACK")
    mantle_chain_id: int = Field(5003, alias="MANTLE_CHAIN_ID")
    mantle_explorer_base: str = Field(
        "https://sepolia.mantlescan.xyz", alias="MANTLE_EXPLORER_BASE"
    )
    mantle_usdc_address: str = Field(
        "0xc92747b1e4Bd5F89BBB66bAE657268a5F4c4850C", alias="MANTLE_USDC_ADDRESS"
    )
    mantle_weth_address: str = Field("", alias="MANTLE_WETH_ADDRESS")
    treasury_eoa: str = Field("", alias="TREASURY_EOA")
    treasury_private_key: str = Field("", alias="TREASURY_PRIVATE_KEY")
    agent_private_key: str = Field("", alias="AGENT_PRIVATE_KEY")
    agent_identity_address: str = Field(
        "0xEc14f781DB5f5f350F26Bc10Fb8f654e1D91daCc", alias="AGENT_IDENTITY_ADDRESS"
    )
    agent_token_id: int = Field(0, alias="AGENT_TOKEN_ID")
    agent_eoa: str = Field(
        "0xFB76C4B6912bCF358752Fb4b4b15B959EfaDD915", alias="AGENT_EOA"
    )

    execution_adapter: str = Field("fusionx_v2", alias="EXECUTION_ADAPTER")
    merchant_moe_router: str = Field("", alias="MERCHANT_MOE_ROUTER")
    merchant_moe_factory: str = Field("", alias="MERCHANT_MOE_FACTORY")
    fusionx_v2_router: str = Field(
        "0x45e6f621c5ED8616cCFB9bBaeBAcF9638aBB0033", alias="FUSIONX_V2_ROUTER"
    )
    fusionx_v2_factory: str = Field(
        "0x272465431A6b86E3B9E5b9bD33f5D103a3F59eDb", alias="FUSIONX_V2_FACTORY"
    )
    fusionx_usdc: str = Field(
        "0xc92747b1e4Bd5F89BBB66bAE657268a5F4c4850C", alias="FUSIONX_USDC"
    )
    fusionx_wmnt: str = Field(
        "",
        validation_alias=AliasChoices("FUSIONX_WMNT", "FUSIONX_WBIT"),
    )
    fusionx_pool_usdc_wmnt: str = Field(
        "",
        validation_alias=AliasChoices(
            "FUSIONX_POOL_USDC_WMNT", "FUSIONX_POOL_USDC_WBIT"
        ),
    )
    mantle_wmnt_address: str = Field("", alias="MANTLE_WMNT_ADDRESS")
    dex_slippage_bps: int = Field(100, alias="DEX_SLIPPAGE_BPS")
    dex_swap_deadline_sec: int = Field(300, alias="DEX_SWAP_DEADLINE_SEC")

    llm_provider: str = Field("z_ai", alias="LLM_PROVIDER")
    llm_provider_chain: str = Field(
        "z_ai,groq,gemini,local_rules", alias="LLM_PROVIDER_CHAIN"
    )
    z_ai_api_key: str = Field("", alias="Z_AI_API_KEY")
    z_ai_base_url: str = Field("https://api.z.ai/api/paas/v4", alias="Z_AI_BASE_URL")
    z_ai_model: str = Field("glm-4-plus", alias="Z_AI_MODEL")
    groq_api_key: str = Field("", alias="GROQ_API_KEY")
    groq_base_url: str = Field("https://api.groq.com/openai/v1", alias="GROQ_BASE_URL")
    groq_model: str = Field("llama-3.3-70b-versatile", alias="GROQ_MODEL")
    gemini_api_key: str = Field("", alias="GEMINI_API_KEY")
    gemini_model: str = Field("gemini-2.5-pro", alias="GEMINI_MODEL")
    prompt_registry_path: str = Field("packages/prompts", alias="PROMPT_REGISTRY_PATH")

    memory_db_path: str = Field("data/ameo.db", alias="MEMORY_DB_PATH")
    log_from_block: int = Field(0, alias="LOG_FROM_BLOCK")
    volatility_threshold_pct: float = Field(0.03, alias="VOLATILITY_THRESHOLD_PCT")
    agent_interval_sec: int = Field(60, alias="AGENT_INTERVAL_SEC")

    zero_g_rpc_url: str = Field("", alias="ZERO_G_RPC_URL")
    zero_g_indexer_url: str = Field("", alias="ZERO_G_INDEXER_URL")
    zero_g_private_key: str = Field("", alias="ZERO_G_PRIVATE_KEY")
    zero_g_cli_path: str = Field("0g-storage-client", alias="ZERO_G_CLI_PATH")
    zero_g_timeout_sec: int = Field(120, alias="ZERO_G_TIMEOUT_SEC")
    zero_g_namespace: str = Field("", alias="ZERO_G_NAMESPACE")

    bybit_base_url: str = Field("https://api.bybit.com", alias="BYBIT_BASE_URL")
    bybit_api_key: str = Field("", alias="BYBIT_API_KEY")
    bybit_api_secret: str = Field("", alias="BYBIT_API_SECRET")

    eval_report_path: str = Field("", alias="EVAL_REPORT_PATH")

    sentry_dsn: str = Field("", alias="SENTRY_DSN")

    live_enabled: bool = Field(True, alias="LIVE_ENABLED")
    worker_mode: str = Field("live_limited", alias="WORKER_MODE")
    max_daily_volume_usd: float = Field(500.0, alias="MAX_DAILY_VOLUME_USD")
    max_position_usd: float = Field(250.0, alias="MAX_POSITION_USD")
    max_drawdown_pct: float = Field(0.12, alias="MAX_DRAWDOWN_PCT")
    asset_whitelist: str = Field("USDC,MNT,WMNT", alias="ASSET_WHITELIST")
    prompt_set_version: str = Field("v1", alias="PROMPT_SET_VERSION")

    http_timeout_sec: float = Field(10.0, alias="HTTP_TIMEOUT_SEC")

    # API key for protecting /v1 endpoints (X-API-KEY header). If empty, v1 is open (dev mode).
    api_key: str = Field("", alias="API_KEY")

    @model_validator(mode="after")
    def validate_live_boot(self) -> Settings:
        """Fail fast when live execution is enabled but critical secrets are missing."""
        if not self.allows_live_execution():
            return self

        missing: list[str] = []
        if not (self.agent_private_key or "").strip():
            missing.append("AGENT_PRIVATE_KEY")
        if not (self.treasury_eoa or "").strip():
            missing.append("TREASURY_EOA")
        if not (self.mantle_rpc_url or "").strip():
            missing.append("MANTLE_RPC_URL")
        if not (self.agent_identity_address or "").strip():
            missing.append("AGENT_IDENTITY_ADDRESS")

        if missing:
            raise ValueError(
                "Live worker boot blocked — missing required env: "
                + ", ".join(missing)
            )
        return self

    def allows_live_execution(self) -> bool:
        """True when live CLI / chain execution is permitted (still subject to policy caps)."""
        if not self.live_enabled:
            return False
        if self.worker_mode == "dry_run":
            return False
        return self.worker_mode in ("live", "live_limited")


@lru_cache
def get_settings() -> Settings:
    return Settings()
