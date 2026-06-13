import { useEffect, useMemo, useRef } from "react";

import { useAmeoUi } from "../context/AmeoUiContext";
import { useEventTail, type EventLine } from "../hooks/useEventTail";
import { useSchedulerStatus } from "../hooks/useSchedulerStatus";
import { runtimeConfig } from "../lib/runtimeConfig";

function humanizeEventDetail(event: EventLine): string {
  const data = event.data ?? {};
  const eventType = event.event_type ?? event.type ?? "event";

  if (eventType === "action_failed") {
    const command = String(data.command ?? "action");
    const error = String(data.error ?? "execution failed");
    return `${command} failed — ${error.slice(0, 120)}`;
  }
  if (eventType === "llm_provider_failed") {
    return `LLM provider ${String(data.provider ?? "unknown")} unavailable`;
  }
  if (eventType === "llm_provider_succeeded") {
    return `Planner active: ${String(data.provider ?? "unknown")}`;
  }
  if (eventType === "action_executed") {
    return `${String(data.command ?? "action")} ${data.ok === false ? "failed" : "succeeded"}`;
  }
  if (eventType === "cycle_completed") {
    return data.ok === false ? "Cycle finished with execution failure" : "Cycle completed";
  }
  if (eventType === "guardrail_evaluated") {
    const violations = Array.isArray(data.violations) ? data.violations : [];
    return violations.length
      ? `Policy blocked: ${violations.join(", ")}`
      : "All guardrails passed";
  }
  if (eventType === "fusionx_quote_fetched" || eventType === "dex_quote_fetched") {
    return "FusionX quote fetched";
  }
  if (event.msg) {
    return event.msg;
  }
  return eventType.replaceAll("_", " ");
}

function formatEventLine(event: EventLine, summaryMode: boolean): string {
  if (event.type === "idle") {
    return "[INFO] Worker idle — waiting for next cycle.";
  }

  const level =
    event.event_type === "action_failed" || event.event_type === "llm_provider_failed"
      ? "WARN"
      : event.event_type === "cycle_completed" ||
          event.event_type === "action_executed" ||
          event.event_type === "llm_provider_succeeded"
        ? event.data?.ok === false
          ? "WARN"
          : "OK"
        : "INFO";

  const cycle = event.cycle_id ? ` cycle=${event.cycle_id}` : "";
  const kind = event.event_type ?? event.type ?? "event";
  const detail = summaryMode
    ? humanizeEventDetail(event)
    : event.msg ??
      (event.data && Object.keys(event.data).length > 0
        ? JSON.stringify(event.data)
        : kind);

  return `[${level}] ${kind}${cycle} — ${detail}`;
}

function renderLogLine(line: string, index: number) {
  let textColor = "text-cream/90";

  if (line.includes("[OK]") || line.includes("[SUCCESS]") || line.includes("[ARCHIVE]")) {
    textColor = "text-green-400 font-semibold";
  } else if (line.includes("[WARN]") || line.includes("[TELEMETRY]")) {
    textColor = "text-[#f59e0b] font-semibold";
  } else if (line.includes("[ERROR]")) {
    textColor = "text-red-400 font-semibold";
  }

  return (
    <div
      key={`${index}-${line.slice(0, 40)}`}
      className="flex gap-2 border-b border-[#2a2421]/30 py-1 font-mono text-[11px] leading-relaxed break-all"
    >
      <span className="shrink-0 font-mono text-[10px] text-muted/40">
        {(index + 1).toString().padStart(3, "0")}
      </span>
      <span className={textColor}>{line}</span>
    </div>
  );
}

type NarrativeConsoleProps = {
  /** Judge-facing dashboard: human-readable lines, no raw JSON payloads. */
  summaryMode?: boolean;
};

export function NarrativeConsole({ summaryMode = false }: NarrativeConsoleProps) {
  const { workerUrl } = useAmeoUi();
  const { lines, idle } = useEventTail(workerUrl);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const { data: schedulerInfo } = useSchedulerStatus();

  const displayedLines =
    lines.length > 0
      ? lines.map((line) => formatEventLine(line, summaryMode))
      : idle
        ? ["[INFO] Worker idle — waiting for next cycle."]
        : ["[INFO] Connecting to worker event stream…"];

  const lastEvent = lines[lines.length - 1];
  const footerMeta = useMemo(() => {
    const lastType = lastEvent?.event_type ?? (idle ? "idle" : "connecting");
    const lastCycle = lastEvent?.cycle_id ?? "—";
    return { lastType, lastCycle };
  }, [idle, lastEvent]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div
      className="neo-card flex flex-col overflow-hidden border-2 border-ink p-0 shadow-[8px_8px_0px_0px_#1f1a17]"
      style={{ backgroundColor: "#171412" }}
    >
      <div className="flex items-center justify-between border-b-2 border-ink bg-[#231e1a] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-ink/40 bg-red-500" />
            <span className="h-2.5 w-2.5 rounded-full border border-ink/40 bg-amber-500" />
            <span className="h-2.5 w-2.5 rounded-full border border-ink/40 bg-green-500" />
          </div>
          <span className="ml-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
            {summaryMode ? "cycle timeline (human-readable)" : "worker telemetry · SSE tail"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!idle && lines.length > 0 ? (
            <>
              <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-green-400" />
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-green-400">
                Live
              </span>
            </>
          ) : (
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted">
              {lines.length > 0 ? "Idle" : "Archive"}
            </span>
          )}
        </div>
      </div>

      <div className="scrollbar-thin scrollbar-thumb-[#2a2421] scrollbar-track-[#171412] h-[550px] space-y-1 overflow-y-auto p-4 font-mono text-[#faf7f2]">
        {displayedLines.map((line, idx) => renderLogLine(line, idx))}

        <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
          <span className="font-mono text-[10px] text-muted/40">
            {(displayedLines.length + 1).toString().padStart(3, "0")}
          </span>
          <span className="animate-pulse font-semibold text-muted">
            &gt; {idle || lines.length === 0
              ? lines.length === 0
                ? "waiting for events · connect worker SSE"
                : `idle · 30min scheduler${schedulerInfo?.next_scheduled_tick ? ` (next: ${new Date(schedulerInfo.next_scheduled_tick).toLocaleTimeString()})` : ''}`
              : "streaming JSONL tail"}
          </span>
          <span
            className="inline-block h-4 w-2 animate-blink bg-muted/60"
            style={{ animation: "blink 1s steps(2, start) infinite" }}
          />
        </div>

        <div ref={terminalEndRef} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink bg-[#231e1a] px-4 py-2 font-mono text-[9px] text-muted">
        <span>SSE · /api/events/tail</span>
        <span>chain {runtimeConfig.mantleChainId}</span>
        <span>last {footerMeta.lastType}</span>
        <span>cycle {footerMeta.lastCycle}</span>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
