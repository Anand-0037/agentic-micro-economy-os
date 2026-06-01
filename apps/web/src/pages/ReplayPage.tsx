import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { CycleReplayCard } from "../components/CycleReplayCard";
import { LocalErrorBoundary } from "../components/LocalErrorBoundary";
import { useCycle, useCyclesList } from "../hooks/useCycles";
import { shortHash } from "../lib/dashboardFormat";

const PAGE_SIZE = 20;

function statusPillClass(status: string) {
  if (status === "verified" || status === "executed") {
    return "bg-[#e2f0d9] text-[#3d7a5f]";
  }
  if (status === "failed") {
    return "bg-red-100 text-red-700";
  }
  return "bg-amber-50 text-amber-800";
}

export function ReplayPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(0, Number(searchParams.get("page") ?? "0"));
  const selectedCycleId = searchParams.get("cycle");

  const { data: listData, isLoading: listLoading, error: listError } = useCyclesList(
    PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const cycles = listData?.cycles ?? [];
  const total = listData?.total ?? 0;

  const activeCycleId = selectedCycleId ?? cycles[0]?.cycle_id ?? null;

  useEffect(() => {
    if (!selectedCycleId && cycles[0]?.cycle_id) {
      const next = new URLSearchParams(searchParams);
      next.set("cycle", cycles[0].cycle_id);
      setSearchParams(next, { replace: true });
    }
  }, [cycles, searchParams, selectedCycleId, setSearchParams]);

  const { data: detail, isLoading: detailLoading, error: detailError } = useCycle(activeCycleId);

  const cycleNumber = useMemo(() => {
    if (!activeCycleId) return 0;
    const index = cycles.findIndex((cycle) => cycle.cycle_id === activeCycleId);
    if (index >= 0) {
      return total - page * PAGE_SIZE - index;
    }
    return total;
  }, [activeCycleId, cycles, page, total]);

  const selectCycle = (cycleId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("cycle", cycleId);
    setSearchParams(next);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl min-w-0 px-4 pb-16 pt-6 md:px-6 md:pt-8 lg:px-8">
      <header className="mb-6 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Narrative Console</p>
        <h1 className="font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">
          Cognition replay
        </h1>
        <p className="mt-2 text-sm text-muted">
          Inspect every cognition cycle the worker has recorded — observation through cryptographic proof.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_1fr]">
        <aside className="soft-card p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold text-ink">Cycles</h2>
            <span className="font-mono text-xs text-muted">{total} total</span>
          </div>

          {listLoading ? (
            <p className="text-sm text-muted">Loading cycles…</p>
          ) : listError ? (
            <p className="text-sm text-danger">Could not load cycles from worker.</p>
          ) : cycles.length === 0 ? (
            <p className="text-sm text-muted">No cognition cycles recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {cycles.map((cycle, index) => {
                const number = total - page * PAGE_SIZE - index;
                const active = cycle.cycle_id === activeCycleId;
                return (
                  <li key={cycle.cycle_id}>
                    <button
                      type="button"
                      className={`w-full rounded border-2 px-3 py-3 text-left transition-colors ${
                        active
                          ? "border-accent bg-sand shadow-[3px_3px_0px_0px_#c86b4a]"
                          : "border-ink/15 bg-surface hover:border-ink/40"
                      }`}
                      onClick={() => selectCycle(cycle.cycle_id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-display text-sm font-semibold text-ink">
                          Cycle #{number}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${statusPillClass(cycle.status)}`}
                        >
                          {cycle.status}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-muted">
                        {new Date(cycle.started_at).toLocaleString()} · {cycle.action_type}
                      </p>
                      {cycle.tx_hash ? (
                        <p className="mt-1 font-mono text-[10px] text-ink/80">
                          tx {shortHash(cycle.tx_hash)}
                        </p>
                      ) : null}
                      {cycle.pnl_1e18 ? (
                        <p className="mt-1 font-mono text-[10px] text-muted">
                          pnl1e18 {cycle.pnl_1e18}
                        </p>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between gap-2 text-xs">
              <button
                type="button"
                className="btn-secondary h-8 px-3 disabled:opacity-50"
                disabled={page <= 0}
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.set("page", String(page - 1));
                  setSearchParams(next);
                }}
              >
                Prev
              </button>
              <span className="text-muted">
                Page {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                className="btn-secondary h-8 px-3 disabled:opacity-50"
                disabled={page + 1 >= totalPages}
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.set("page", String(page + 1));
                  setSearchParams(next);
                }}
              >
                Next
              </button>
            </div>
          ) : null}
        </aside>

        <div className="min-w-0">
          {detailLoading ? (
            <div className="neo-card p-8 text-sm text-muted">Loading cycle drilldown…</div>
          ) : detailError || !detail ? (
            <div className="neo-card p-8 text-sm text-muted">
              Select a cycle to inspect the full cognition tree.
            </div>
          ) : (
            <LocalErrorBoundary title="Cycle replay failed to render.">
              <CycleReplayCard detail={detail} cycleNumber={cycleNumber} />
            </LocalErrorBoundary>
          )}
        </div>
      </div>
    </div>
  );
}
