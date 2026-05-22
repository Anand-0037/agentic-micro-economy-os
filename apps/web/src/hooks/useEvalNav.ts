import { useEffect, useState } from "react";

import { useAmeoUi } from "../context/AmeoUiContext";

type EvalPayload = {
  available?: boolean;
  report?: { sample_count?: number };
};

export function useEvalNav() {
  const { workerUrl } = useAmeoUi();
  const [sampleCount, setSampleCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${workerUrl}/api/eval-report`);
        if (!res.ok) {
          throw new Error("eval fetch failed");
        }
        const data = (await res.json()) as EvalPayload;
        if (!cancelled) {
          const count =
            data.available && typeof data.report?.sample_count === "number"
              ? data.report.sample_count
              : 0;
          setSampleCount(count);
        }
      } catch {
        if (!cancelled) {
          setSampleCount(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [workerUrl]);

  return {
    loading,
    sampleCount,
    showEvalTab: !loading && (sampleCount ?? 0) > 0,
  };
}
