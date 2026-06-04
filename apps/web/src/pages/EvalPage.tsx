import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Skeleton } from "../components/ui/Skeleton";
import { useAmeoUi } from "../context/AmeoUiContext";

type EvalPayload = {
  available?: boolean;
  message?: string;
  path?: string;
  report?: Record<string, unknown>;
};

function NumCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="soft-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-3 font-display text-3xl font-semibold tabular-nums text-ink">{value}</p>
      {caption ? <p className="mt-2 text-xs text-muted">{caption}</p> : null}
    </div>
  );
}

export function EvalPage() {
  const { workerUrl, workerApiKey } = useAmeoUi();
  const [payload, setPayload] = useState<EvalPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${workerUrl}/api/eval-report`, {
          headers: workerApiKey ? { "X-API-KEY": workerApiKey } : undefined,
        });
        if (!res.ok) {
          throw new Error("Request failed");
        }
        const data = (await res.json()) as EvalPayload;
        if (!cancelled) {
          setPayload(data);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load eval report.");
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [workerUrl]);

  const report = payload?.report;
  const sampleCount =
    typeof report?.sample_count === "number" ? report.sample_count : 0;
  const available = payload?.available && sampleCount > 0;
  const genAt = typeof report?.generated_at === "string" ? report.generated_at : null;

  return (
    <div className="app-page mx-auto max-w-6xl px-4 pb-16 md:px-6 lg:px-8">
      <header className="mb-8 max-w-3xl space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Benchmarks</p>
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Eval</h1>
        <p className="text-sm text-muted">
          Decision-quality metrics from the worker memory database eval harness.
        </p>
      </header>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {!payload ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-28 w-full" />
          ))}
        </div>
      ) : !available ? (
        <div className="soft-card space-y-4 p-6 text-sm text-muted">
          <p className="font-semibold text-ink">Eval data not yet generated.</p>
          <p>
            Run at least 5 agent cycles, then from the repo root run{" "}
            <code className="rounded bg-neutral-100 px-1 font-mono text-xs">
              cd apps/worker && uv run python ../../scripts/generate_eval_report.py
            </code>{" "}
            to populate <code className="font-mono text-xs">eval_report.json</code>.
          </p>
          <p>
            <Link className="font-semibold text-accent hover:underline" to="/app">
              ← Back to Console
            </Link>
          </p>
          {payload.message ? <p className="text-xs">{payload.message}</p> : null}
        </div>
      ) : (
        <>
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumCard
              label="Total samples"
              value={String(sampleCount)}
              caption="Cycles in eval window"
            />
            <NumCard
              label="Sharpe (proxy)"
              value={
                typeof report?.sharpe_ratio === "number"
                  ? report.sharpe_ratio.toFixed(4)
                  : "—"
              }
              caption="From worker memory DB"
            />
            <NumCard
              label="Max drawdown"
              value={
                typeof report?.max_drawdown === "number"
                  ? report.max_drawdown.toFixed(4)
                  : "—"
              }
            />
            <NumCard
              label="Window"
              value={
                typeof report?.window_days === "number"
                  ? `${report.window_days} days`
                  : "—"
              }
              caption={genAt ? `Generated ${new Date(genAt).toLocaleString()}` : undefined}
            />
          </div>

          <section className="soft-card space-y-3 p-6">
            <h2 className="font-display text-lg font-semibold text-ink">Limitations</h2>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              <li>
                Metrics are proxy calculations from the worker memory database, not audited
                live trading performance.
              </li>
              <li>
                Sharpe and drawdown assume the recorded PnL series is complete and correctly
                timestamped.
              </li>
              <li>
                Eval does not substitute for on-chain verification — use the Decisions log for
                proof of agent actions.
              </li>
              <li>
                Sample size and market regime strongly affect interpretability; compare only
                within the same eval window.
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
