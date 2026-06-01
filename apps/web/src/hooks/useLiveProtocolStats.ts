import { useQuery } from "@tanstack/react-query";

import { apiGet } from "../lib/apiClient";
import { runtimeConfig } from "../lib/runtimeConfig";

type WorkerRoot = {
  last_cycle_id?: string | null;
  uptime_seconds?: number;
};

export type PublicConfig = {
  cycles_completed?: number;
  daily_notional_usd_today?: number;
};

export type LiveProtocolStatsData = {
  online: boolean;
  root: WorkerRoot | null;
  config: PublicConfig | null;
};

const REFETCH_MS = 30_000;

export function useLiveProtocolStats() {
  const workerUrl = runtimeConfig.workerUrl;

  return useQuery({
    queryKey: ["live-protocol-stats", workerUrl],
    queryFn: async (): Promise<LiveProtocolStatsData> => {
      try {
        const [root, config] = await Promise.all([
          apiGet<WorkerRoot>(workerUrl, "/", 8000),
          apiGet<PublicConfig>(workerUrl, "/api/public-config", 8000).catch(
            () => ({}) as PublicConfig,
          ),
        ]);
        return { online: true, root, config };
      } catch {
        return { online: false, root: null, config: null };
      }
    },
    refetchInterval: REFETCH_MS,
    staleTime: 10_000,
  });
}
