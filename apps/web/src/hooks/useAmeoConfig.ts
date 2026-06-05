import { useQuery } from "@tanstack/react-query";

import { useAmeoUi } from "../context/AmeoUiContext";
import { apiGet } from "../lib/apiClient";
import { runtimeConfig } from "../lib/runtimeConfig";

export type AmeoConfig = {
  guardrails: string[];
  max_position_usd: number;
  max_daily_volume_usd: number;
  volatility_threshold_pct: number;
  dex_slippage_bps: number;
  llm_provider_chain: string[];
  execution_adapter: string;
  asset_whitelist: string[];
  max_drawdown_pct?: number;
  allowed_protocols?: string[];
};

const STALE_TIME_MS = 30_000;

const FALLBACK_GUARDRAILS = [
  "MaxDrawdownCheck",
  "AssetWhitelistCheck",
  "TradeSizeCheck",
  "GasBudgetCheck",
  "MinimumBalanceCheck",
  "SlippageToleranceCheck",
  "ExecutionFrequencyCheck",
];

export function useAmeoConfig() {
  const { workerUrl, workerApiKey } = useAmeoUi();

  const query = useQuery({
    queryKey: ["ameo-config", workerUrl],
    queryFn: async (): Promise<AmeoConfig> => {
      return apiGet<AmeoConfig>(workerUrl, "/v1/config", 8000, workerApiKey);
    },
    staleTime: STALE_TIME_MS,
    retry: 1,
  });

  // Sensible fallbacks derived from runtimeConfig (used only if live fetch fails)
  const fallback: AmeoConfig = {
    guardrails: FALLBACK_GUARDRAILS,
    max_position_usd: runtimeConfig.maxTradeUsd,
    max_daily_volume_usd: 500,
    volatility_threshold_pct: runtimeConfig.volatilityThresholdPct,
    dex_slippage_bps: 100,
    llm_provider_chain: ["z_ai", "groq", "gemini", "local_rules"],
    execution_adapter: runtimeConfig.executionAdapter,
    asset_whitelist: ["USDC", "MNT"],
    max_drawdown_pct: 0.12,
    allowed_protocols: ["fusionx_v2"],
  };

  const effective: AmeoConfig = query.data ?? fallback;

  return {
    ...query,
    config: effective,
    isUsingFallback: !query.isSuccess,
    guardrailsCount: effective.guardrails.length,
  };
}
