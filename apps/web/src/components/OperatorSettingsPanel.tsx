import { useEffect, useState } from "react";

import { useDemoMode } from "../context/DemoModeContext";
import { useAmeoUi } from "../context/AmeoUiContext";
import { useAmeo } from "../context/AmeoDataContext";
import { usePrefersReducedMotion, setReducedMotionOverride } from "../hooks/usePrefersReducedMotion";
import { useStackHealth } from "../hooks/useStackHealth";
import { useSystemStatus } from "../hooks/useSystemStatus";
import { captureSentryTestError } from "./SentryErrorFallback";
import { InlineToast } from "./ui/InlineToast";
import { StatusDot } from "./ui/StatusDot";

const defaultRpc = import.meta.env.VITE_MANTLE_RPC_URL ?? "https://rpc.mantle.xyz";
const defaultChain = import.meta.env.VITE_MANTLE_CHAIN_ID ?? "5000";
const sentryEnv = import.meta.env.VITE_SENTRY_ENVIRONMENT ?? "unknown";
const sentryConfigured = Boolean(import.meta.env.VITE_SENTRY_DSN);

type OperatorSettingsPanelProps = {
  active?: boolean;
};

function stackLabel(ok: boolean | null): string {
  if (ok === null) return "—";
  return ok ? "ok" : "down";
}

export function OperatorSettingsPanel({ active = true }: OperatorSettingsPanelProps) {
  const { demoMode, setDemoMode } = useDemoMode();
  const reducedMotion = usePrefersReducedMotion();
  const { dev } = useSystemStatus();
  const { workerUrl, setWorkerUrl } = useAmeoUi();
  const { runner, actionLoading, startRunner, stopRunner, restartRunner } = useAmeo();
  const [draftUrl, setDraftUrl] = useState(workerUrl);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: "ok" | "error" } | null>(
    null,
  );
  const { health, refresh } = useStackHealth(workerUrl, active);

  useEffect(() => {
    setDraftUrl(workerUrl);
  }, [workerUrl]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    setToast(null);
    const next = draftUrl.trim();
    setWorkerUrl(next);
    try {
      const res = await fetch(`${next.replace(/\/$/, "")}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        setToast({ variant: "ok", message: `Reconnected to ${next}` });
        await refresh();
      } else {
        setToast({ variant: "error", message: `Failed to reach ${next}` });
      }
    } catch {
      setToast({ variant: "error", message: `Failed to reach ${next}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-border bg-neutral-50 p-4">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="text-sm font-medium text-ink">Demo mode (hide operator UI)</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#E8622A]"
            checked={demoMode}
            onChange={(e) => setDemoMode(e.target.checked)}
          />
        </label>
        <p className="mt-2 text-xs text-muted">
          Hides gear icon, warnings, build version, and bootstrap callouts. Enable with{" "}
          <code className="font-mono">?demo=1</code> before recording. Exit with{" "}
          <code className="font-mono">?demo=0</code> or turn this off.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-neutral-50 p-4">
        <label className="flex cursor-pointer items-center justify-between gap-3">
          <span className="text-sm font-medium text-ink">Reduce motion</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#E8622A]"
            checked={reducedMotion}
            onChange={(e) => setReducedMotionOverride(e.target.checked)}
          />
        </label>
        <p className="mt-2 text-xs text-muted">
          Respects OS <code className="font-mono">prefers-reduced-motion</code> and adds a manual
          override stored in this browser.
        </p>
      </section>

      {/* Section A — Worker connection */}
      <section aria-labelledby="settings-worker-heading">
        <h3
          id="settings-worker-heading"
          className="text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Worker connection
        </h3>
        <div className="mt-3 space-y-3">
          <label
            htmlFor="worker-api-url"
            className="block text-sm font-medium text-ink"
          >
            Worker API base URL
          </label>
          <input
            id="worker-api-url"
            className="w-full rounded-md border border-border bg-surface px-3 py-2 font-mono text-sm"
            name="workerUrl"
            type="url"
            value={draftUrl}
            onChange={(e) => setDraftUrl(e.target.value)}
          />
          <button
            className="btn-primary h-10 px-4 text-sm font-semibold disabled:opacity-60"
            type="button"
            disabled={saving}
            onClick={() => {
              void handleSave();
            }}
          >
            {saving ? "Reconnecting…" : "Save & reconnect"}
          </button>
          {toast ? <InlineToast message={toast.message} variant={toast.variant} /> : null}
          <p className="flex items-center gap-2 text-xs text-muted">
            <StatusDot ok={health.worker} />
            <span>
              Current: <span className="font-mono">{workerUrl}</span>
            </span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            <button
              className="btn-secondary h-9 px-3 text-xs font-semibold disabled:opacity-60"
              type="button"
              disabled={actionLoading || runner.running}
              onClick={() => {
                void startRunner();
              }}
            >
              Start runner
            </button>
            <button
              className="btn-secondary h-9 px-3 text-xs font-semibold disabled:opacity-60"
              type="button"
              disabled={actionLoading || !runner.running}
              onClick={() => {
                void stopRunner();
              }}
            >
              Stop runner
            </button>
            <button
              className="btn-secondary h-9 px-3 text-xs font-semibold disabled:opacity-60"
              type="button"
              disabled={actionLoading}
              onClick={() => {
                void restartRunner();
              }}
            >
              Restart worker
            </button>
          </div>
        </div>
      </section>

      {/* Section B — Live stack info */}
      <section aria-labelledby="settings-stack-heading">
        <h3
          id="settings-stack-heading"
          className="text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Live stack
        </h3>
        <p className="mt-3 text-sm text-muted">
          Data is fetched live from the worker API, Mantle RPC, and 0G storage. No cached or
          mock data.
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <StatusDot ok={health.worker} />
            <span>
              Worker — <span className="font-medium text-ink">{stackLabel(health.worker)}</span>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <StatusDot ok={health.mantleRpc} />
            <span>
              Mantle RPC —{" "}
              <span className="font-medium text-ink">{stackLabel(health.mantleRpc)}</span>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <StatusDot ok={health.zeroG} />
            <span>
              0G storage —{" "}
              <span className="font-medium text-ink">{stackLabel(health.zeroG)}</span>
            </span>
          </li>
        </ul>
      </section>

      {/* Section C — Developer tools (collapsed) */}
      <details className="rounded-lg border border-border bg-neutral-50">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-ink marker:content-none">
          <svg
            className="h-4 w-4 text-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
          Developer tools
        </summary>
        <div className="space-y-5 border-t border-border px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              System diagnostics
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-surface p-3 font-mono text-[0.65rem] leading-relaxed text-muted">
              {JSON.stringify(dev, null, 2)}
            </pre>
            {dev.llmError ? (
              <p className="mt-2 text-xs text-muted">
                LLM detail: {dev.llmError}
              </p>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Observability
            </p>
            <p className="mt-2 text-sm text-muted">
              Sentry {sentryConfigured ? "configured" : "not configured"} ({sentryEnv})
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="btn-secondary h-9 px-3 text-xs font-semibold"
                type="button"
                onClick={() => captureSentryTestError()}
              >
                Test client Sentry
              </button>
              <button
                className="btn-secondary h-9 px-3 text-xs font-semibold"
                type="button"
                onClick={() => {
                  void fetch(`${workerUrl}/sentry-debug`);
                }}
              >
                Test worker Sentry
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Build-time chain hints
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-surface p-3 font-mono text-[0.65rem] leading-relaxed text-muted">
              {`VITE_MANTLE_RPC_URL=${defaultRpc}\nVITE_MANTLE_CHAIN_ID=${defaultChain}`}
            </pre>
            <p className="mt-2 text-xs text-muted">
              These are baked in at build time. To change them, rebuild the web image.
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
