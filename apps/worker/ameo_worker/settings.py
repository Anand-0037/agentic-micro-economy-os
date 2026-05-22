from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_REPO_ROOT / ".env"),
        env_prefix="",
        extra="ignore",
    )

    mantle_rpc_url: str = Field(..., alias="MANTLE_RPC_URL")
    mantle_rpc_url_fallback: str = Field("", alias="MANTLE_RPC_URL_FALLBACK")
    mantle_chain_id: int = Field(5000, alias="MANTLE_CHAIN_ID")
    mantle_usdc_address: str = Field("", alias="MANTLE_USDC_ADDRESS")
    mantle_weth_address: str = Field("", alias="MANTLE_WETH_ADDRESS")
    treasury_eoa: str = Field("", alias="TREASURY_EOA")
    agent_private_key: str = Field("", alias="AGENT_PRIVATE_KEY")
    agent_identity_address: str = Field("", alias="AGENT_IDENTITY_ADDRESS")
    agent_token_id: int = Field(0, alias="AGENT_TOKEN_ID")

    execution_adapter: str = Field("mantle_dex", alias="EXECUTION_ADAPTER")
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
    fusionx_wbit: str = Field(
        "0x8734110e5e1dcF439c7F549db740E546fea82d66", alias="FUSIONX_WBIT"
    )
    mantle_wmnt_address: str = Field("", alias="MANTLE_WMNT_ADDRESS")
    dex_slippage_bps: int = Field(100, alias="DEX_SLIPPAGE_BPS")
    dex_swap_deadline_sec: int = Field(300, alias="DEX_SWAP_DEADLINE_SEC")

    llm_provider: str = Field("z_ai", alias="LLM_PROVIDER")
    z_ai_api_key: str = Field("", alias="Z_AI_API_KEY")
    z_ai_base_url: str = Field("https://api.z.ai/api/paas/v4", alias="Z_AI_BASE_URL")
    z_ai_model: str = Field("glm-5-turbo", alias="Z_AI_MODEL")
    groq_api_key: str = Field("", alias="GROQ_API_KEY")
    groq_base_url: str = Field("https://api.groq.com/openai/v1", alias="GROQ_BASE_URL")
    groq_model: str = Field("llama-3.3-70b-versatile", alias="GROQ_MODEL")
    gemini_api_key: str = Field("", alias="GEMINI_API_KEY")
    gemini_model: str = Field("gemini-1.5-pro-002", alias="GEMINI_MODEL")
    prompt_registry_path: str = Field("", alias="PROMPT_REGISTRY_PATH")

    memory_db_path: str = Field("", alias="MEMORY_DB_PATH")
    volatility_threshold_pct: float = Field(0.05, alias="VOLATILITY_THRESHOLD_PCT")
    agent_interval_sec: int = Field(300, alias="AGENT_INTERVAL_SEC")

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

    live_enabled: bool = Field(False, alias="LIVE_ENABLED")
    worker_mode: str = Field("live_limited", alias="WORKER_MODE")
    max_daily_volume_usd: float = Field(0.0, alias="MAX_DAILY_VOLUME_USD")
    max_position_usd: float = Field(0.0, alias="MAX_POSITION_USD")
    prompt_set_version: str = Field("v1", alias="PROMPT_SET_VERSION")

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
