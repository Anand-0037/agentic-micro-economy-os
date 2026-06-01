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

const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1000;

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

    let es: EventSource | null = null;
    let reconnectTimer: number | undefined;
    let attempt = 0;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;

      es = new EventSource(
        `${workerUrl.replace(/\/$/, "")}/api/events/tail?limit=${limit}`,
      );

      es.onopen = () => {
        attempt = 0;
        setIdle(false);
      };

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
        es?.close();
        es = null;
        setIdle(true);
        if (cancelled) return;

        const delay = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
        attempt += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      es?.close();
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
    };
  }, [workerUrl, limit]);

  return { lines, idle };
}
