import { useQuery } from "@tanstack/react-query";

import { useAmeoUi } from "../context/AmeoUiContext";
import { apiGet } from "../lib/apiClient";

export type SchedulerStatus = {
  enabled?: boolean;
  interval_minutes?: number;
  next_scheduled_tick?: string | null;
  last_cycle_id?: string | null;
  uptime_seconds?: number;
};

const REFETCH_MS = 30_000;

export function useSchedulerStatus() {
  const { workerUrl } = useAmeoUi();

  return useQuery({
    queryKey: ["scheduler-status", workerUrl],
    queryFn: () => apiGet<SchedulerStatus>(workerUrl, "/v1/scheduler/status"),
    refetchInterval: REFETCH_MS,
    staleTime: 10_000,
  });
}
