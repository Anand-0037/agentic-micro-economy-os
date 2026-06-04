const env = import.meta.env;

function pctDisplay(raw: string | undefined, fallback: number): string {
  const value = Number(raw ?? fallback);
  if (!Number.isFinite(value)) return `${fallback * 100}%`;
  return `${(value * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

export const runtimeConfig = {
  mantleRpcUrl: env.VITE_MANTLE_RPC_URL ?? "https://rpc.sepolia.mantle.xyz",
  mantleChainId: env.VITE_MANTLE_CHAIN_ID ?? "5003",
  explorerBase: env.VITE_MANTLE_EXPLORER_BASE ?? "https://sepolia.mantlescan.xyz",
  agentIdentityAddress:
    env.VITE_AGENT_IDENTITY_ADDRESS ?? "0xE6038881c6533D284906695A5708bC0954678945", // CRITICAL: must match worker AGENT_IDENTITY_ADDRESS and on-chain mint; set in Vercel for prod
  agentTokenId: env.VITE_AGENT_TOKEN_ID ?? "0",
  agentEoa: env.VITE_AGENT_EOA ?? "0xFB76C4B6912bCF358752Fb4b4b15B959EfaDD915",
  treasuryEoa: env.VITE_TREASURY_EOA ?? "",
  executionAdapter: env.VITE_EXECUTION_ADAPTER ?? "fusionx_v2",
  executionAdapterLabel: env.VITE_EXECUTION_ADAPTER_LABEL ?? "FusionX V2 DEX",
  fusionxRouter:
    env.VITE_FUSIONX_V2_ROUTER ?? "0x45e6f621c5ED8616cCFB9bBaeBAcF9638aBB0033",
  llmProviderLabel: env.VITE_LLM_PROVIDER_LABEL ?? "z.ai",
  llmModel: env.VITE_Z_AI_MODEL ?? "glm-4-plus",
  groqModel: env.VITE_GROQ_MODEL ?? "llama-3.3-70b-versatile",
  geminiModel: env.VITE_GEMINI_MODEL ?? "gemini-2.5-pro",
  volatilityThresholdPct: Number(env.VITE_VOLATILITY_THRESHOLD_PCT ?? "0.03"),
  maxTradeUsd: Number(env.VITE_MAX_TRADE_USD ?? "250"),
  signingMethod: env.VITE_SIGNING_METHOD ?? "Hot EOA Private Key (Isolated .env)",
  zeroGIndexerUrl:
    env.VITE_0G_INDEXER_URL ?? "https://indexer-storage-testnet-turbo.0g.ai",
  githubUrl: env.VITE_GITHUB_URL ?? "",
  docsUrl: env.VITE_DOCS_URL ?? "https://docs.ameo.agiwithai.com",
  workerUrl: env.VITE_WORKER_URL ?? "https://agentic-micro-economy-os.onrender.com",
  workerApiKey: env.VITE_WORKER_API_KEY ?? "",
} as const;

const CRITICAL_ENV_KEYS = [
  "VITE_AGENT_IDENTITY_ADDRESS",
  "VITE_WORKER_URL",
  "VITE_MANTLE_RPC_URL",
] as const;

export function validateRuntimeConfig(): void {
  const missing = CRITICAL_ENV_KEYS.filter((key) => {
    const value = env[key];
    return !value || String(value).trim() === "";
  });

  if (missing.length === 0) return;

  const message = `[AMEO] Missing critical env: ${missing.join(", ")}. Using fallbacks — verify Vercel/local .env.`;
  if (import.meta.env.DEV) {
    console.warn(message);
  }
}

export function formatVolatilityTriggerExample(): string {
  const threshold = runtimeConfig.volatilityThresholdPct;
  const exampleMove = threshold + 0.012;
  return pctDisplay(String(exampleMove), 0.042);
}

export function executionTargetLabel(): string {
  return `${runtimeConfig.fusionxRouter} (${runtimeConfig.executionAdapterLabel})`;
}

export function executionStepTitle(): string {
  return `Execution · ${runtimeConfig.executionAdapterLabel}`;
}

export function executionStepDescription(): string {
  return `Signing and submitting transaction via ${runtimeConfig.executionAdapterLabel} (${runtimeConfig.executionAdapter}).`;
}

export function sampleSwapDescription(amountUsd = 150): string {
  return `Swap ${amountUsd.toFixed(2)} USDC for MNT via ${runtimeConfig.executionAdapterLabel}`;
}

export function sampleThoughtProcess(amountUsd = 150): string {
  const move = formatVolatilityTriggerExample();
  return `MNT price dropped ${move} relative to USDC in the last 24h (threshold ${pctDisplay(String(runtimeConfig.volatilityThresholdPct), 0.03)}). Portfolio holds 85% USDC. Allocating ${amountUsd} USDC to acquire MNT via ${runtimeConfig.executionAdapterLabel} under policy caps.`;
}
