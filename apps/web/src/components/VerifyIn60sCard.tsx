import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useCycle, useCyclesList } from "../hooks/useCycles";
import { shortAddress, shortHash } from "../lib/dashboardFormat";
import { Skeleton } from "./ui/Skeleton";

type VerifyIn60sCardProps = {
  variant?: "landing" | "console";
  demoMode?: boolean;
};

const explorerBase =
  import.meta.env.VITE_MANTLE_EXPLORER_BASE ?? "https://sepolia.mantlescan.xyz";
const agentIdentityAddress = import.meta.env.VITE_AGENT_IDENTITY_ADDRESS;
const zeroGIndexerBase =
  import.meta.env.VITE_0G_INDEXER_URL ?? "https://indexer-storage-testnet-turbo.0g.ai";

function normalizeTxHash(hash?: string | null): string | null {
  if (!hash) return null;
  return hash.startsWith("0x") ? hash : `0x${hash}`;
}

function buildVerificationBundle(detail: NonNullable<ReturnType<typeof useCycle>["data"]>) {
  return {
    cycle_id: detail.summary.cycle_id,
    rationaleHash: detail.decision_log?.rationaleHash ?? null,
    txHash: detail.tx_hash?.hash ?? detail.summary.tx_hash ?? null,
    zeroGRoot: detail.zero_g?.root_hash ?? detail.decision_log?.dataHash ?? null,
    mantleExplorerUrl: detail.tx_hash?.explorer_url ?? null,
    indexerUrl: detail.zero_g?.indexer_url ?? null,
  };
}

export function VerifyIn60sCard({ variant = "landing", demoMode = false }: VerifyIn60sCardProps) {
  const [copied, setCopied] = useState(false);
  const { data: listData, isLoading, isError } = useCyclesList(50, 0);

  const verifyCycle = useMemo(() => {
    const cycles = listData?.cycles ?? [];
    return cycles.find((cycle) => cycle.tx_hash) ?? cycles[0] ?? null;
  }, [listData?.cycles]);

  const { data: detail, isLoading: detailLoading } = useCycle(verifyCycle?.cycle_id);

  const identityUrl = agentIdentityAddress
    ? `${explorerBase}/address/${agentIdentityAddress}#code`
    : null;

  const txHash = normalizeTxHash(detail?.tx_hash?.hash ?? verifyCycle?.tx_hash);
  const txUrl = txHash ? `${explorerBase}/tx/${txHash}` : null;
  const zeroGRoot =
    (detail?.zero_g?.root_hash as string | undefined) ??
    (detail?.decision_log?.dataHash as string | undefined) ??
    null;
  const zeroGUrl = zeroGRoot
    ? `${zeroGIndexerBase.replace(/\/$/, "")}/file/${zeroGRoot}`
    : null;
  const replayUrl = verifyCycle?.cycle_id
    ? `/app/replay?cycle=${encodeURIComponent(verifyCycle.cycle_id)}`
    : null;

  if (demoMode && isError) {
    return null;
  }

  if (isError && import.meta.env.PROD) {
    return null;
  }

  if (isError) {
    return (
      <section
        className={`neo-card-sm border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 ${
          variant === "landing" ? "mx-auto max-w-6xl px-4 md:px-6" : ""
        }`}
        aria-live="polite"
      >
        Worker offline — verification card hidden in production.
      </section>
    );
  }

  const loading = isLoading || detailLoading || !verifyCycle;

  const copyBundle = async () => {
    if (!detail) return;
    await navigator.clipboard.writeText(JSON.stringify(buildVerificationBundle(detail), null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const card = (
    <section
      className="neo-card border-2 border-ink bg-surface p-5 sm:p-6"
      aria-labelledby={`verify-60s-heading-${variant}`}
    >
      <header className="mb-5 border-b border-ink/10 pb-4">
        <h2
          id={`verify-60s-heading-${variant}`}
          className="font-display text-lg font-semibold text-ink sm:text-xl"
        >
          Verify this project in 60 seconds.
        </h2>
        <p className="mt-1 text-sm text-muted">
          Open these four links in order. None of them are mocks.
        </p>
      </header>

      <ol className="space-y-4">
        <li className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink bg-accent font-display text-sm font-bold text-surface">
            1
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Verified ERC-8004 contract</p>
            {loading ? (
              <Skeleton className="mt-2 h-4 w-48" />
            ) : identityUrl ? (
              <a
                className="mt-1 inline-flex font-mono text-xs text-accent underline-offset-4 hover:underline"
                href={identityUrl}
                rel="noreferrer"
                target="_blank"
              >
                {shortAddress(agentIdentityAddress)} ↗
              </a>
            ) : (
              <p className="mt-1 text-xs text-muted">Set VITE_AGENT_IDENTITY_ADDRESS to verify.</p>
            )}
          </div>
        </li>

        <li className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink bg-accent font-display text-sm font-bold text-surface">
            2
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Latest DecisionLogged event</p>
            {loading ? (
              <Skeleton className="mt-2 h-4 w-56" />
            ) : txUrl && verifyCycle ? (
              <a
                className="mt-1 inline-flex font-mono text-xs text-accent underline-offset-4 hover:underline"
                href={txUrl}
                rel="noreferrer"
                target="_blank"
              >
                {shortHash(txHash ?? undefined)} · Cycle #{verifyCycle.cycle_id} ↗
              </a>
            ) : (
              <p className="mt-1 text-xs text-muted">No on-chain tx recorded for the latest cycle yet.</p>
            )}
          </div>
        </li>

        <li className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink bg-accent font-display text-sm font-bold text-surface">
            3
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">0G reasoning trace</p>
            {loading ? (
              <Skeleton className="mt-2 h-4 w-52" />
            ) : zeroGUrl && zeroGRoot ? (
              <a
                className="mt-1 inline-flex font-mono text-xs text-accent underline-offset-4 hover:underline"
                href={zeroGUrl}
                rel="noreferrer"
                target="_blank"
              >
                {shortHash(zeroGRoot)} ↗
              </a>
            ) : (
              <p className="mt-1 text-xs text-muted">
                No 0G Storage receipt anchored for this cycle yet.
              </p>
            )}
          </div>
        </li>

        <li className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink bg-accent font-display text-sm font-bold text-surface">
            4
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">Replay this cycle</p>
            {loading ? (
              <Skeleton className="mt-2 h-4 w-40" />
            ) : replayUrl ? (
              <Link
                className="mt-1 inline-flex text-xs font-semibold text-accent underline-offset-4 hover:underline"
                to={replayUrl}
              >
                9 nodes, real on-chain →
              </Link>
            ) : (
              <p className="mt-1 text-xs text-muted">Run a cognition cycle to enable replay.</p>
            )}
          </div>
        </li>
      </ol>

      <button
        type="button"
        className="neo-button mt-5 border-2 border-ink bg-sand px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink disabled:opacity-50"
        disabled={!detail}
        onClick={() => {
          void copyBundle();
        }}
      >
        {copied ? "Copied" : "Copy verification bundle"}
      </button>
    </section>
  );

  if (variant === "landing") {
    return (
      <div className="border-b border-border bg-bg/95 md:sticky md:top-16 md:z-20 md:backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">{card}</div>
      </div>
    );
  }

  return card;
}
