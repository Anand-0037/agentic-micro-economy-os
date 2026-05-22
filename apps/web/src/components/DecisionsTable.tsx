import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { VerifiableLog } from "../hooks/useAmeo";
import { decisionStatus, shortHash } from "../lib/dashboardFormat";
import { Skeleton } from "./ui/Skeleton";

const DEFAULT_PAGE_SIZE = 10;

type DecisionsTableProps = {
  logs: VerifiableLog[];
  loading: boolean;
  error?: string | null;
  logsLastSuccessAt?: string | null;
  explorerBase: string;
  identityExplorerUrl?: string;
  onRefresh: () => void;
  onScrollToRun?: () => void;
  /** Max rows shown (dashboard preview). Omit for full list. */
  limit?: number;
  /** Enable prev/next pagination (decisions page). */
  paginated?: boolean;
  pageSize?: number;
  showIdentityFooter?: boolean;
  viewAllHref?: string;
  emptyStateTarget?: "dashboard" | "decisions";
  hasEverRun?: boolean;
  title?: string;
  compact?: boolean;
};

function statusGlyph(status: ReturnType<typeof decisionStatus>) {
  if (status === "ok") return "✅";
  if (status === "warn") return "⚠️";
  return "❌";
}

export function DecisionsTable({
  logs,
  loading,
  error,
  logsLastSuccessAt,
  explorerBase,
  identityExplorerUrl,
  onRefresh,
  onScrollToRun,
  limit,
  paginated = false,
  pageSize = DEFAULT_PAGE_SIZE,
  showIdentityFooter = true,
  viewAllHref,
  emptyStateTarget = "dashboard",
  hasEverRun = false,
  title = "Decisions",
  compact = false,
}: DecisionsTableProps) {
  const [page, setPage] = useState(0);

  const totalPages = paginated
    ? Math.max(1, Math.ceil(logs.length / pageSize))
    : 1;
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, totalPages - 1)));
  }, [totalPages, logs.length]);

  const visibleLogs = useMemo(() => {
    if (limit !== undefined && !paginated) {
      return logs.slice(0, limit);
    }
    if (paginated) {
      const start = safePage * pageSize;
      return logs.slice(start, start + pageSize);
    }
    return logs;
  }, [limit, logs, paginated, pageSize, safePage]);

  return (
    <section
      className="soft-card min-h-[min(32rem,55vh)] p-5 sm:p-8"
      aria-labelledby="decisions-heading"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="decisions-heading"
            className="font-display text-xl font-semibold text-ink sm:text-2xl"
          >
            {title}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Verifiable DecisionLogged events on Mantle — the on-chain proof log.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 space-y-2">
          {[0, 1, 2, 3, 4].map((key) => (
            <Skeleton key={key} className="h-11 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-6 rounded-lg border border-danger/20 bg-danger/5 p-4 text-sm">
          <p className="font-semibold text-danger">
            {error}{" "}
            <button
              type="button"
              className="font-semibold text-accent underline"
              onClick={onRefresh}
            >
              Retry
            </button>
          </p>
          {logsLastSuccessAt ? (
            <p className="mt-2 text-xs text-muted">
              Last successful read: {new Date(logsLastSuccessAt).toLocaleTimeString()}
            </p>
          ) : null}
        </div>
      ) : logs.length === 0 && !hasEverRun ? (
        <p className="mt-6 text-sm text-muted">
          No decisions yet.{" "}
          {emptyStateTarget === "decisions" ? (
            <>
              Click{" "}
              <Link className="font-semibold text-accent hover:underline" to="/app#agent-control">
                Run cycle
              </Link>{" "}
              from the Narrative Console to record the first one on-chain.
            </>
          ) : (
            <>
              Click{" "}
              <button
                type="button"
                className="font-semibold text-accent hover:underline"
                onClick={onScrollToRun}
              >
                Run cycle
              </button>{" "}
              above to record the first one on-chain.
            </>
          )}
        </p>
      ) : logs.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No on-chain decisions in this window yet.</p>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="pb-2 pr-4 font-semibold">Time</th>
                  <th className="pb-2 pr-4 font-semibold">Action</th>
                  <th className="pb-2 pr-4 font-semibold">Amount</th>
                  <th className="pb-2 pr-4 font-semibold">Tx</th>
                  <th className="pb-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map((log) => {
                  const status = decisionStatus(log.actionType);
                  const pnl =
                    log.pnl1e18 !== undefined
                      ? (Number(log.pnl1e18) / 1e18).toFixed(4)
                      : null;
                  return (
                    <tr
                      key={`${log.txHash}-${log.rationaleHash}`}
                      className="border-b border-border/50"
                    >
                      <td className="py-3 pr-4 tabular-nums text-muted">On-chain</td>
                      <td className="py-3 pr-4 font-medium">{log.actionType}</td>
                      <td className="py-3 pr-4 tabular-nums text-muted">
                        {pnl !== null ? `PnL ${pnl}` : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        {log.txHash ? (
                          <a
                            className="font-mono text-xs text-accent hover:underline"
                            href={`${explorerBase}/tx/${log.txHash}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            {shortHash(log.txHash)} ↗
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="py-3" aria-label={status}>
                        {statusGlyph(status)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {paginated && logs.length > pageSize ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-xs text-muted">
                Showing {safePage * pageSize + 1}–
                {Math.min((safePage + 1) * pageSize, logs.length)} of {logs.length}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-secondary h-9 px-3 text-xs font-semibold disabled:opacity-50"
                  disabled={safePage <= 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn-secondary h-9 px-3 text-xs font-semibold disabled:opacity-50"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}

          {viewAllHref && logs.length > (limit ?? 0) ? (
            <p className="mt-4 text-sm">
              <Link className="font-semibold text-accent hover:underline" to={viewAllHref}>
                View all {logs.length} decisions →
              </Link>
            </p>
          ) : null}
        </>
      )}

      {showIdentityFooter && !compact ? (
        <div className="mt-6 flex flex-wrap gap-3 border-t border-border pt-4">
          {identityExplorerUrl ? (
            <>
              <a
                className="btn-secondary inline-flex h-10 items-center px-4 text-xs font-semibold"
                href={identityExplorerUrl}
                rel="noreferrer"
                target="_blank"
              >
                Verify on Mantle Explorer ↗
              </a>
              <a
                className="btn-secondary inline-flex h-10 items-center px-4 text-xs font-semibold"
                href={identityExplorerUrl}
                rel="noreferrer"
                target="_blank"
              >
                View identity contract ↗
              </a>
            </>
          ) : (
            <p className="text-xs text-muted">Identity contract address not configured.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
