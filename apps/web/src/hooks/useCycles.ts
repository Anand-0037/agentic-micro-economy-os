import { useQuery } from "@tanstack/react-query";

import { useAmeoUi } from "../context/AmeoUiContext";

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
  pnl_1e18?: string | null;
  has_zero_g_receipt: boolean;
};

export type CycleDetail = {
  summary: CycleSummary;
  observation: Record<string, unknown>;
  treasury: Record<string, unknown>;
  market_signal: Record<string, unknown>;
  plan: Record<string, unknown>;
  policy_checks: PolicyCheck[];
  policy_snapshot: Record<string, unknown>;
  execution: Record<string, unknown>;
  tx_hash: { hash?: string | null; explorer_url?: string | null };
  decision_log?: Record<string, unknown> | null;
  zero_g?: Record<string, unknown> | null;
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
      const response = await fetch(`${workerUrl}/api/cycles?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to load cognition cycles");
      }
      return (await response.json()) as CyclesListResponse;
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
      const response = await fetch(`${workerUrl}/api/cycles/${cycleId}`);
      if (!response.ok) {
        throw new Error("Failed to load cycle detail");
      }
      return (await response.json()) as CycleDetail;
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
