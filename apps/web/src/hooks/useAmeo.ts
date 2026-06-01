import { useCallback, useEffect, useState } from "react";

import { useAmeoUi } from "../context/AmeoUiContext";
import { apiGet, apiPost, apiRequest } from "../lib/apiClient";

export type StatusResponse = {
  updated_at?: string | null;
  observation?: {
    balances?: Record<string, number>;
    macro_signals?: Record<string, unknown>;
    gas_price_wei?: number | null;
  } | null;
  last_execution?: {
    ok?: boolean;
    error?: string | null;
    tx_hash?: string | null;
  } | null;
};

export type VerifiableLog = {
  txHash: string;
  agentId: string;
  rationaleHash: string;
  actionType: string;
  metadataUri: string;
  dataHash: string;
  pnl1e18?: string;
};

export type HistoryPoint = {
  created_at: string;
  pnl: number;
};

export type Learning = {
  created_at: string;
  lesson: string;
};

export type RunnerStatus = {
  running: boolean;
  started_at?: string | null;
  last_cycle_at?: string | null;
  cycles_completed?: number;
  active_for_seconds?: number;
  last_error?: string | null;
};

export type Trophy = {
  best_win?: {
    created_at: string;
    pnl: number;
    action_type?: string | null;
  } | null;
  highlight_lesson?: {
    created_at: string;
    lesson: string;
  } | null;
};

type Performance = {
  sharpe: number;
  drawdown: number;
};

type HistoryPayload = {
  history?: HistoryPoint[];
  learnings?: Learning[];
  best_win?: Trophy["best_win"];
};

const POLL_INTERVAL_MS = 15000;

export function useAmeoQueries() {
  const { workerUrl } = useAmeoUi();
  const agentIdentityAddress = import.meta.env
    .VITE_AGENT_IDENTITY_ADDRESS as `0x${string}` | undefined;
  const agentTokenId = import.meta.env.VITE_AGENT_TOKEN_ID ?? "0";
  const logFromBlock = import.meta.env.VITE_LOG_FROM_BLOCK ?? "0";

  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [runner, setRunner] = useState<RunnerStatus>({ running: false });
  const [logs, setLogs] = useState<VerifiableLog[]>([]);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [learnings, setLearnings] = useState<Learning[]>([]);
  const [trophy, setTrophy] = useState<Trophy>({});
  const [performance, setPerformance] = useState<Performance>({
    sharpe: 0,
    drawdown: 0,
  });

  const [statusLoading, setStatusLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [runnerLoading, setRunnerLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const [statusError, setStatusError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [runnerError, setRunnerError] = useState<string | null>(null);
  const [healthOk, setHealthOk] = useState(true);
  const [llmOk, setLlmOk] = useState<boolean | null>(null);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [llmChain, setLlmChain] = useState<{
    active_provider?: string;
    available_providers?: string[];
    last_failover_at?: string | null;
  } | null>(null);
  const [logsLastSuccessAt, setLogsLastSuccessAt] = useState<string | null>(null);

  const fetchStatus = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) {
        setStatusLoading(true);
      }
      try {
        const payload = await apiGet<StatusResponse>(workerUrl, "/api/status", 5000);
        setStatus(payload);
        setStatusError(null);
      } catch {
        setStatusError("Could not reach worker status.");
      } finally {
        setStatusLoading(false);
      }
    },
    [workerUrl],
  );

  const fetchRunner = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) {
        setRunnerLoading(true);
      }
      try {
        const payload = await apiGet<RunnerStatus>(workerUrl, "/api/runner", 5000);
        setRunner(payload);
        setRunnerError(null);
      } catch {
        setRunnerError("Runner heartbeat unavailable.");
      } finally {
        setRunnerLoading(false);
      }
    },
    [workerUrl],
  );

  const fetchLogs = useCallback(
    async (showSpinner: boolean) => {
      if (!agentIdentityAddress) {
        setLogsError("Agent identity address is missing.");
        setLogsLoading(false);
        return;
      }
      if (showSpinner) {
        setLogsLoading(true);
      }
      try {
        const params = new URLSearchParams({ from_block: logFromBlock });
        const payload = await apiGet<{ logs?: VerifiableLog[]; error?: string }>(
          workerUrl,
          `/api/decisions?${params.toString()}`,
          8000,
        );
        if (payload.error) {
          throw new Error(payload.error);
        }
        setLogs(payload.logs ?? []);
        setLogsError(null);
        setLogsLastSuccessAt(new Date().toISOString());
      } catch (err) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Could not load on-chain decisions. Check worker connection in ⚙.";
        setLogsError(message);
      } finally {
        setLogsLoading(false);
      }
    },
    [agentIdentityAddress, logFromBlock, workerUrl],
  );

  const fetchHistory = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) {
        setHistoryLoading(true);
      }
      try {
        const payload = await apiGet<HistoryPayload>(workerUrl, "/api/history", 8000);
        setHistory(payload.history ?? []);
        setLearnings(payload.learnings ?? []);
        setTrophy((current) => ({
          ...current,
          best_win: payload.best_win ?? null,
        }));
        setHistoryError(null);
      } catch {
        setHistoryError("Could not load memory history.");
      } finally {
        setHistoryLoading(false);
      }
    },
    [workerUrl],
  );

  const fetchPerformance = useCallback(async () => {
    try {
      const payload = await apiGet<{ sharpe?: number; drawdown?: number }>(
        workerUrl,
        "/api/performance",
        5000,
      );
      setPerformance({
        sharpe: payload.sharpe ?? 0,
        drawdown: payload.drawdown ?? 0,
      });
    } catch {
      setPerformance({ sharpe: 0, drawdown: 0 });
    }
  }, [workerUrl]);

  const fetchTrophy = useCallback(async () => {
    try {
      const payload = await apiGet<Trophy>(workerUrl, "/api/trophy", 5000);
      setTrophy(payload);
    } catch {
      setTrophy((current) => current);
    }
  }, [workerUrl]);

  const startRunner = useCallback(async () => {
    setActionLoading(true);
    try {
      await apiPost(workerUrl, "/api/start", 8000);
      await fetchRunner(false);
      setRunnerError(null);
    } catch {
      setRunnerError("Could not start runner.");
    } finally {
      setActionLoading(false);
    }
  }, [fetchRunner, workerUrl]);

  const fetchLlmDiagnostics = useCallback(async () => {
    try {
      const payload = await apiGet<{
        ok?: boolean;
        error?: unknown;
        active_provider?: string;
        available_providers?: string[];
        last_failover_at?: string | null;
      }>(workerUrl, "/diagnostics/llm", 8000);
      const ok = Boolean(payload.ok);
      setLlmOk(ok);
      setLlmChain({
        active_provider: payload.active_provider,
        available_providers: payload.available_providers,
        last_failover_at: payload.last_failover_at,
      });
      setLlmError(
        ok
          ? null
          : typeof payload.error === "string"
            ? payload.error
            : "LLM diagnostics failed",
      );
    } catch {
      setLlmOk(false);
      setLlmError("Could not reach LLM diagnostics.");
    }
  }, [workerUrl]);

  const fetchLlmChain = useCallback(async () => {
    try {
      const payload = await apiGet<{
        active_provider?: string;
        available_providers?: string[];
        last_failover_at?: string | null;
      }>(workerUrl, "/api/llm-chain", 5000);
      setLlmChain(payload);
    } catch {
      setLlmChain(null);
    }
  }, [workerUrl]);

  const restartRunner = useCallback(async () => {
    setActionLoading(true);
    try {
      if (runner.running) {
        await apiPost(workerUrl, "/api/stop", 8000);
      }
      await apiPost(workerUrl, "/api/start", 8000);
      await fetchRunner(false);
      setRunnerError(null);
    } catch {
      setRunnerError("Could not restart worker.");
    } finally {
      setActionLoading(false);
    }
  }, [fetchRunner, runner.running, workerUrl]);

  const stopRunner = useCallback(async () => {
    setActionLoading(true);
    try {
      await apiPost(workerUrl, "/api/stop", 8000);
      await fetchRunner(false);
      setRunnerError(null);
    } catch {
      setRunnerError("Could not stop runner.");
    } finally {
      setActionLoading(false);
    }
  }, [fetchRunner, workerUrl]);

  const triggerCycle = useCallback(async () => {
    setActionLoading(true);
    setStatusError(null);
    try {
      await apiPost(workerUrl, "/run-cycle", 15000);
      await Promise.all([
        fetchStatus(false),
        fetchLogs(false),
        fetchHistory(false),
        fetchPerformance(),
        fetchRunner(false),
        fetchTrophy(),
      ]);
    } catch {
      setStatusError("Manual trigger failed. Check the worker logs.");
    } finally {
      setActionLoading(false);
    }
  }, [
    fetchHistory,
    fetchLogs,
    fetchPerformance,
    fetchRunner,
    fetchStatus,
    fetchTrophy,
    workerUrl,
  ]);

  const refreshAll = useCallback(
    async (showSpinner: boolean) => {
      await Promise.all([
        fetchStatus(showSpinner),
        fetchRunner(showSpinner),
        fetchLogs(showSpinner),
        fetchHistory(showSpinner),
        fetchPerformance(),
        fetchTrophy(),
      ]);
    },
    [
      fetchHistory,
      fetchLogs,
      fetchPerformance,
      fetchRunner,
      fetchStatus,
      fetchTrophy,
    ],
  );

  useEffect(() => {
    void refreshAll(true);
    void fetchLlmDiagnostics();
    const interval = window.setInterval(() => {
      void refreshAll(false);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchLlmDiagnostics, refreshAll]);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        await apiRequest(workerUrl, "/health", { timeoutMs: 5000 });
        if (!cancelled) {
          setHealthOk(true);
        }
      } catch {
        if (!cancelled) {
          setHealthOk(false);
        }
      }
      if (!cancelled) {
        await fetchLlmDiagnostics();
        await fetchLlmChain();
      }
    };
    void ping();
    const id = window.setInterval(ping, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fetchLlmChain, fetchLlmDiagnostics, workerUrl]);

  return {
    status,
    runner,
    logs,
    history,
    learnings,
    performance,
    trophy,
    statusLoading,
    logsLoading,
    historyLoading,
    runnerLoading,
    actionLoading,
    statusError,
    logsError,
    historyError,
    runnerError,
    startRunner,
    stopRunner,
    triggerCycle,
    refreshLogs: () => fetchLogs(true),
    refreshHistory: async () => {
      await fetchHistory(true);
      await fetchPerformance();
      await fetchTrophy();
    },
    healthOk,
    llmOk,
    llmError,
    llmChain,
    logsLastSuccessAt,
    restartRunner,
    refreshLlmDiagnostics: fetchLlmDiagnostics,
    refreshAll,
  };
}
