import type { PolicyDisplayRow } from "../lib/policyHumanize";
import { Skeleton } from "./ui/Skeleton";

type ActivePolicyCardProps = {
  rows: PolicyDisplayRow[];
  loading?: boolean;
  error?: string | null;
};

export function ActivePolicyCard({ rows, loading, error }: ActivePolicyCardProps) {
  return (
    <div className="mt-6 rounded-lg border border-border/80 bg-surface p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Active policy</h3>
      {loading ? (
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-8 w-full" />
          ))}
        </div>
      ) : error ? (
        <p className="mt-2 text-xs text-muted">{error}</p>
      ) : (
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted">
                {row.label}
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
