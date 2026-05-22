import { useCallback, useEffect, useState } from "react";

import { useAmeoUi } from "../context/AmeoUiContext";

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
        const response = await fetch(`${workerUrl}/api/status`);
        if (!response.ok) {
          throw new Error("Status fetch failed");
        }
        const payload = (await response.json()) as StatusResponse;
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
        const response = await fetch(`${workerUrl}/api/runner`);
        if (!response.ok) {
          throw new Error("Runner fetch failed");
        }
        const payload = (await response.json()) as RunnerStatus;
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
        const response = await fetch(`${workerUrl}/api/decisions?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Decisions fetch failed");
        }
        const payload = (await response.json()) as {
          logs?: VerifiableLog[];
          error?: string;
        };
        if (payload.error) {
          throw new Error(payload.error);
        }
        setLogs(payload.logs ?? []);
        setLogsError(null);
        setLogsLastSuccessAt(new Date().toISOString());
      } catch {
        setLogsError("Could not load on-chain decisions. Check worker connection in ⚙.");
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
        const response = await fetch(`${workerUrl}/api/history`);
        if (!response.ok) {
          throw new Error("History fetch failed");
        }
        const payload = (await response.json()) as HistoryPayload;
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
      const response = await fetch(`${workerUrl}/api/performance`);
      if (!response.ok) {
        throw new Error("Performance fetch failed");
      }
      const payload = await response.json();
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
      const response = await fetch(`${workerUrl}/api/trophy`);
      if (!response.ok) {
        throw new Error("Trophy fetch failed");
      }
      const payload = (await response.json()) as Trophy;
      setTrophy(payload);
    } catch {
      setTrophy((current) => current);
    }
  }, [workerUrl]);

  const startRunner = useCallback(async () => {
    setActionLoading(true);
    try {
      const response = await fetch(`${workerUrl}/api/start`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Start failed");
      }
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
      const response = await fetch(`${workerUrl}/diagnostics/llm`);
      if (!response.ok) {
        throw new Error("LLM diagnostics unavailable");
      }
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: unknown;
        active_provider?: string;
        available_providers?: string[];
        last_failover_at?: string | null;
      };
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
      const response = await fetch(`${workerUrl}/api/llm-chain`);
      if (!response.ok) return;
      const payload = (await response.json()) as {
        active_provider?: string;
        available_providers?: string[];
        last_failover_at?: string | null;
      };
      setLlmChain(payload);
    } catch {
      setLlmChain(null);
    }
  }, [workerUrl]);

  const restartRunner = useCallback(async () => {
    setActionLoading(true);
    try {
      if (runner.running) {
        await fetch(`${workerUrl}/api/stop`, { method: "POST" });
      }
      const response = await fetch(`${workerUrl}/api/start`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Restart failed");
      }
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
      const response = await fetch(`${workerUrl}/api/stop`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Stop failed");
      }
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
      const response = await fetch(`${workerUrl}/run-cycle`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Cycle trigger failed");
      }
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
        const response = await fetch(`${workerUrl}/health`);
        if (!cancelled) {
          setHealthOk(response.ok);
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
