/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_WORKER_URL?: string;
  readonly VITE_MANTLE_RPC_URL?: string;
  readonly VITE_MANTLE_RPC_URL_FALLBACK?: string;
  readonly VITE_MANTLE_CHAIN_ID?: string;
  readonly VITE_AGENT_IDENTITY_ADDRESS?: string;
  readonly VITE_AGENT_TOKEN_ID?: string;
  readonly VITE_AGENT_EOA?: string;
  readonly VITE_MANTLE_EXPLORER_BASE?: string;
  readonly VITE_LOG_FROM_BLOCK?: string;
  readonly VITE_TREASURY_EOA?: string;
  readonly VITE_DOCS_URL?: string;
  readonly VITE_GITHUB_URL?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_0G_INDEXER_URL?: string;
  readonly VITE_0G_EXPLORER_BASE?: string;
  readonly VITE_EXECUTION_ADAPTER?: string;
  readonly VITE_EXECUTION_ADAPTER_LABEL?: string;
  readonly VITE_FUSIONX_V2_ROUTER?: string;
  readonly VITE_LLM_PROVIDER_LABEL?: string;
  readonly VITE_Z_AI_MODEL?: string;
  readonly VITE_GROQ_MODEL?: string;
  readonly VITE_GEMINI_MODEL?: string;
  readonly VITE_VOLATILITY_THRESHOLD_PCT?: string;
  readonly VITE_MAX_TRADE_USD?: string;
  readonly VITE_SIGNING_METHOD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
