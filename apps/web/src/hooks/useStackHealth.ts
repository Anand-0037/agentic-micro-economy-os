import { useCallback, useEffect, useState } from "react";

import { apiGet } from "../lib/apiClient";

export type StackHealth = {
  worker: boolean | null;
  mantleRpc: boolean | null;
};

async function pingWorker(baseUrl: string): Promise<boolean> {
  try {
    await apiGet(baseUrl, "/health", 5000);
    return true;
  } catch {
    return false;
  }
}

async function pingMantleRpc(workerUrl: string): Promise<boolean> {
  try {
    const json = await apiGet<{ ok?: boolean }>(workerUrl, "/api/mantle-probe", 8000);
    return Boolean(json.ok);
  } catch {
    return false;
  }
}

export function useStackHealth(workerUrl: string, enabled: boolean) {
  const [health, setHealth] = useState<StackHealth>({
    worker: null,
    mantleRpc: null,
  });

  const refresh = useCallback(async () => {
    const worker = await pingWorker(workerUrl);
    const mantleRpc = worker ? await pingMantleRpc(workerUrl) : false;
    setHealth({ worker, mantleRpc });
  }, [workerUrl]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, 12000);
    return () => window.clearInterval(id);
  }, [enabled, refresh]);

  return { health, refresh };
}
