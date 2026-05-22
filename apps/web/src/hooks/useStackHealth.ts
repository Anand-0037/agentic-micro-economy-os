import { useCallback, useEffect, useState } from "react";

export type StackHealth = {
  worker: boolean | null;
  mantleRpc: boolean | null;
  zeroG: boolean | null;
};

async function pingWorker(baseUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function pingMantleRpc(workerUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${workerUrl.replace(/\/$/, "")}/api/mantle-probe`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { ok?: boolean };
    return Boolean(json.ok);
  } catch {
    return false;
  }
}

async function pingZeroG(workerUrl: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${workerUrl.replace(/\/$/, "")}/api/zero-g-probe`, {
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { configured?: boolean; ok?: boolean };
    if (json.configured === false) return null;
    return Boolean(json.ok);
  } catch {
    return false;
  }
}

export function useStackHealth(workerUrl: string, enabled: boolean) {
  const [health, setHealth] = useState<StackHealth>({
    worker: null,
    mantleRpc: null,
    zeroG: null,
  });

  const refresh = useCallback(async () => {
    const worker = await pingWorker(workerUrl);
    const [mantleRpc, zeroG] = await Promise.all([
      worker ? pingMantleRpc(workerUrl) : Promise.resolve(false),
      worker ? pingZeroG(workerUrl) : Promise.resolve(null),
    ]);
    setHealth({ worker, mantleRpc, zeroG });
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
