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
  readonly VITE_MANTLE_EXPLORER_BASE?: string;
  readonly VITE_LOG_FROM_BLOCK?: string;
  readonly VITE_TREASURY_EOA?: string;
  readonly VITE_DOCS_URL?: string;
  readonly VITE_GITHUB_URL?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_0G_INDEXER_URL?: string;
  readonly VITE_0G_EXPLORER_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
