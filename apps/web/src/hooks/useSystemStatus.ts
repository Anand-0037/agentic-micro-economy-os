import { useCallback, useMemo } from "react";

import { useAmeo } from "../context/AmeoDataContext";
import { useAmeoUi } from "../context/AmeoUiContext";
import { useStackHealth } from "./useStackHealth";

export type DevDiagnostics = {
  workerReachable: boolean;
  runnerError: string | null;
  statusError: string | null;
  logsError: string | null;
  llmOk: boolean | null;
  llmError: string | null;
  mantleRpc: boolean | null;
  zeroG: boolean | null;
};

export type SystemStatus = {
  cyclesCompleted: number;
  hasEverRun: boolean;
  critical: { message: string; actionLabel?: string } | null;
  warning: { message: string } | null;
  runCycleDisabled: boolean;
  dev: DevDiagnostics;
  retryAll: () => Promise<void>;
};

export function useSystemStatus(): SystemStatus {
  const { workerUrl } = useAmeoUi();
  const {
    healthOk,
    runner,
    logs,
    logsError,
    statusError,
    runnerError,
    llmOk,
    llmError,
    refreshLogs,
    refreshLlmDiagnostics,
    refreshAll,
    startRunner,
  } = useAmeo();

  const { health: stackHealth, refresh: refreshStack } = useStackHealth(workerUrl, true);

  const cyclesCompleted = runner.cycles_completed ?? 0;
  const hasEverRun = cyclesCompleted > 0 || logs.length > 0;

  const retryAll = useCallback(async () => {
    if (!healthOk) {
      await startRunner();
    }
    await Promise.all([
      refreshStack(),
      refreshLogs(),
      refreshLlmDiagnostics(),
      refreshAll(false),
    ]);
  }, [
    healthOk,
    refreshAll,
    refreshLlmDiagnostics,
    refreshLogs,
    refreshStack,
    startRunner,
  ]);

  return useMemo(() => {
    const dev: DevDiagnostics = {
      workerReachable: healthOk,
      runnerError,
      statusError,
      logsError,
      llmOk,
      llmError,
      mantleRpc: stackHealth.mantleRpc,
      zeroG: stackHealth.zeroG,
    };

    let critical: SystemStatus["critical"] = null;

    if (!healthOk) {
      critical = {
        message: "Worker is offline. Start the worker to run cycles.",
        actionLabel: "Retry",
      };
    }

    return {
      cyclesCompleted,
      hasEverRun,
      critical,
      warning: null,
      runCycleDisabled: !healthOk,
      dev,
      retryAll,
    };
  }, [
    cyclesCompleted,
    hasEverRun,
    healthOk,
    retryAll,
    runnerError,
    statusError,
    logsError,
    llmOk,
    llmError,
    stackHealth.mantleRpc,
    stackHealth.zeroG,
  ]);
}
