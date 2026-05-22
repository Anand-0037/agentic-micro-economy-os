import { useEffect, useRef } from "react";

import { useAmeoUi } from "../context/AmeoUiContext";
import { useEventTail, type EventLine } from "../hooks/useEventTail";

function formatEventLine(event: EventLine): string {
  if (event.type === "idle") {
    return "[INFO] Worker idle — waiting for next cycle.";
  }

  const level =
    event.event_type === "action_failed" || event.event_type === "llm_provider_failed"
      ? "ERROR"
      : event.event_type === "cycle_completed" ||
          event.event_type === "action_executed" ||
          event.event_type === "llm_provider_succeeded"
        ? "SUCCESS"
        : "INFO";

  const cycle = event.cycle_id ? ` cycle=${event.cycle_id}` : "";
  const kind = event.event_type ?? event.type ?? "event";
  const detail =
    event.msg ??
    (event.data && Object.keys(event.data).length > 0
      ? JSON.stringify(event.data)
      : kind);

  return `[${level}] ${kind}${cycle} — ${detail}`;
}

function renderLogLine(line: string, index: number) {
  let textColor = "text-cream/90";

  if (line.includes("[SUCCESS]") || line.includes("[OK]")) {
    textColor = "text-green-400 font-semibold";
  } else if (line.includes("[WARN]")) {
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

export function NarrativeConsole() {
  const { workerUrl } = useAmeoUi();
  const { lines, idle } = useEventTail(workerUrl);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const displayedLines =
    lines.length > 0 ? lines.map(formatEventLine) : idle ? ["[INFO] Worker idle — waiting for next cycle."] : [];

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayedLines.length]);

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
            am-os-worker // telemetry_stream
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!idle && lines.length > 0 ? (
            <>
              <span className="inline-block h-1.5 w-1.5 animate-ping rounded-full bg-green-400" />
              <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-green-400">
                Live Stream
              </span>
            </>
          ) : (
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-muted">
              Idle
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
            &gt; {idle || lines.length === 0 ? "waiting for worker events" : "streaming JSONL tail"}
          </span>
          <span
            className="inline-block h-4 w-2 animate-blink bg-muted/60"
            style={{ animation: "blink 1s steps(2, start) infinite" }}
          />
        </div>

        <div ref={terminalEndRef} />
      </div>

      <div className="flex items-center justify-between border-t border-ink bg-[#231e1a] px-4 py-2 font-mono text-[9px] text-muted">
        <span>ENCODING: UTF-8</span>
        <span>EIP-8004 LOGS</span>
        <span>MANTLE_SEPOLIA: 5003</span>
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
