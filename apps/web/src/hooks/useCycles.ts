import { useQuery } from "@tanstack/react-query";

import { useAmeoUi } from "../context/AmeoUiContext";
import { apiGet } from "../lib/apiClient";

export type PolicyCheck = {
  rule: string;
  passed: boolean;
  reason: string;
};

export type CycleSummary = {
  cycle_id: string;
  started_at: string;
  ended_at?: string | null;
  action_type: string;
  status: string;
  tx_hash?: string | null;
  rationale_hash?: string | null;
  pnl_1e18?: string | null;
  has_zero_g_receipt: boolean;
  has_volatility_response?: boolean;
  has_policy_rejection?: boolean;
};

export type CycleObservation = {
  balances?: Record<string, number>;
  gas_price_wei?: number;
  block_number?: number;
  rpc_url?: string;
  observation_quality?: number;
  sources?: string[];
  errors?: string[];
};

export type CyclePlan = {
  planner_version?: string;
  action_type?: string;
  protocol?: string;
  rationale?: string;
  rationale_summary?: string;
  correlation_id?: string;
  plan?: Record<string, unknown>;
};

export type CycleExecution = {
  ok?: boolean;
  sender?: string;
  target_contract?: string;
  method?: string;
  protocol?: string;
  slippage_bps?: number;
  calldata?: { block_number?: number } & Record<string, unknown>;
  error?: string;
};

export type CycleTxHash = {
  hash?: string | null;
  block_number?: number;
  explorer_url?: string | null;
};

export type CycleDecisionLog = {
  rationaleHash?: string;
  dataHash?: string;
  txHash?: string;
  actionType?: string;
  verify_url?: string;
};

export type CycleZeroG = {
  root_hash?: string;
  indexer_url?: string;
};

export type CycleDetail = {
  summary: CycleSummary;
  observation: CycleObservation;
  treasury: Record<string, unknown>;
  market_signal: Record<string, unknown>;
  plan: CyclePlan;
  policy_checks: PolicyCheck[];
  policy_snapshot: Record<string, unknown>;
  execution: CycleExecution;
  tx_hash: CycleTxHash;
  decision_log?: CycleDecisionLog | null;
  zero_g?: CycleZeroG | null;
};

type CyclesListResponse = {
  cycles: CycleSummary[];
  total: number;
};

const STALE_TIME_MS = 10_000;

export function useCyclesList(limit = 50, offset = 0) {
  const { workerUrl } = useAmeoUi();

  return useQuery({
    queryKey: ["cycles", workerUrl, limit, offset],
    queryFn: async (): Promise<CyclesListResponse> => {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      return apiGet<CyclesListResponse>(workerUrl, `/api/cycles?${params.toString()}`);
    },
    staleTime: STALE_TIME_MS,
  });
}

export function useCycle(cycleId: string | null | undefined) {
  const { workerUrl } = useAmeoUi();

  return useQuery({
    queryKey: ["cycle", workerUrl, cycleId],
    enabled: Boolean(cycleId),
    queryFn: async (): Promise<CycleDetail> => {
      if (!cycleId) {
        throw new Error("Cycle ID is required");
      }
      return apiGet<CycleDetail>(workerUrl, `/api/cycles/${cycleId}`);
    },
    staleTime: STALE_TIME_MS,
  });
}

export function useReplayNav() {
  const { data, isLoading } = useCyclesList(1, 0);

  return {
    loading: isLoading,
    cycleCount: data?.total ?? 0,
    showReplayTab: !isLoading && (data?.total ?? 0) > 0,
  };
}
