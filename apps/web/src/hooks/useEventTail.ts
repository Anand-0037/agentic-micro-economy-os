import { useEffect, useState } from "react";

export type EventLine = {
  event_id?: string;
  cycle_id?: string;
  timestamp?: string;
  event_type?: string;
  data?: Record<string, unknown>;
  type?: string;
  msg?: string;
  [k: string]: unknown;
};

export function useEventTail(workerUrl: string, limit = 200) {
  const [lines, setLines] = useState<EventLine[]>([]);
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (!workerUrl) {
      setLines([]);
      setIdle(true);
      return undefined;
    }

    setLines([]);
    setIdle(false);

    const es = new EventSource(`${workerUrl.replace(/\/$/, "")}/api/events/tail?limit=${limit}`);

    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as EventLine;
        if (parsed.type === "idle") {
          setIdle(true);
          return;
        }
        setIdle(false);
        setLines((current) => [...current.slice(-limit + 1), parsed]);
      } catch {
        /* ignore malformed SSE payloads */
      }
    };

    es.onerror = () => {
      /* leave open; browser auto-reconnects */
    };

    return () => es.close();
  }, [workerUrl, limit]);

  return { lines, idle };
}
