import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useCycle, useCyclesList } from "../hooks/useCycles";
import { shortAddress, shortHash, explorerTxUrl } from "../lib/dashboardFormat";
import { runtimeConfig } from "../lib/runtimeConfig";
import { Skeleton } from "./ui/Skeleton";
import { useAgentProfile } from "../hooks/useAgentProfile";

const explorerBase = runtimeConfig.explorerBase;
const agentIdentityAddress = runtimeConfig.agentIdentityAddress;
const workerBase = runtimeConfig.workerUrl.replace(/\/$/, "");
const workerApiKey = runtimeConfig.workerApiKey;

type VerifyIn60sCardProps = {
  variant?: "landing" | "console";
};

function normalizeTxHash(hash?: string | null): string | null {
  if (!hash) return null;
  const trimmed = String(hash).trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
}

function buildVerificationBundle(detail: NonNullable<ReturnType<typeof useCycle>["data"]>) {
  return {
    cycle_id: detail.summary.cycle_id,
    rationaleHash: detail.decision_log?.rationaleHash ?? null,
    txHash: detail.tx_hash?.hash ?? detail.summary.tx_hash ?? null,
    mantleExplorerUrl: detail.tx_hash?.explorer_url ?? null,
  };
}

export function VerifyIn60sCard({ variant = "landing" }: VerifyIn60sCardProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timeoutRef = useRef<number>();
  const { data: listData, isLoading, isError } = useCyclesList(50, 0);
  const { data: profile } = useAgentProfile();

  const verifyCycle = useMemo(() => {
    const cycles = listData?.cycles ?? [];
    return (
      cycles.find((c) => c.action_type === "policy_blocked" && c.tx_hash) ??
      cycles.find((c) => c.tx_hash) ??
      cycles[0] ??
      null
    );
  }, [listData?.cycles]);

  const { data: detail, isLoading: detailLoading } = useCycle(verifyCycle?.cycle_id);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const identityUrl = agentIdentityAddress
    ? `${explorerBase}/address/${agentIdentityAddress}#code`
    : null;

  const txHash = normalizeTxHash(detail?.tx_hash?.hash ?? verifyCycle?.tx_hash);
  const txUrl = explorerTxUrl(explorerBase, txHash);
  const apiVerifyUrl = txHash ? `${workerBase}/v1/verify/${txHash}` : null;
  const replayUrl = verifyCycle?.cycle_id
    ? `/app/replay?cycle=${encodeURIComponent(verifyCycle.cycle_id)}`
    : null;

  const loading = !isError && (isLoading || detailLoading || !verifyCycle);

  const copyBundle = async () => {
    const bundle = detail ? buildVerificationBundle(detail) : null;
    if (!bundle) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => setCopyStatus("idle"), 2500);
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
          {isError
            ? "Live worker unavailable. Set VITE_WORKER_URL and redeploy."
            : "Open these four links in order from the latest real cycle."}
        </p>
      </header>

      <ol className="space-y-4">
        <li className="flex gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink bg-accent font-display text-sm font-bold text-surface">
            1
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">AMEO decision ledger (custom contract)</p>
            {loading ? (
              <Skeleton className="mt-2 h-4 w-48" />
            ) : identityUrl ? (
              <>
                <a
                  className="mt-1 inline-flex font-mono text-xs text-accent underline-offset-4 hover:underline"
                  href={identityUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  {shortAddress(agentIdentityAddress)} ↗
                </a>
                {profile?.capabilities && profile.capabilities.length > 0 && (
                  <p className="mt-1 text-[10px] font-mono text-muted">
                    Capabilities: <span className="text-[#3d7a5f] font-semibold">{profile.capabilities.join(", ")}</span>
                  </p>
                )}
              </>
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
                {shortHash(txHash ?? undefined)} · Cycle {verifyCycle.cycle_id} ↗
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
            <p className="text-sm font-semibold text-ink">REST verify endpoint</p>
            {loading ? (
              <Skeleton className="mt-2 h-4 w-52" />
            ) : isError ? (
              <p className="mt-1 text-xs text-muted">Worker API unavailable.</p>
            ) : apiVerifyUrl && txHash ? (
              <a
                className="mt-1 inline-flex font-mono text-xs text-accent underline-offset-4 hover:underline"
                href={apiVerifyUrl}
                rel="noreferrer"
                target="_blank"
              >
                GET /v1/verify/{shortHash(txHash)} ↗
              </a>
            ) : (
              <p className="mt-1 text-xs text-muted">No settlement tx to verify via API yet.</p>
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
            ) : isError ? (
              <p className="mt-1 text-xs text-muted">Worker API unavailable.</p>
            ) : replayUrl ? (
              <Link
                className="mt-1 inline-flex text-xs font-semibold text-accent underline-offset-4 hover:underline"
                to={replayUrl}
              >
                5-step cognition replay, real on-chain →
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
        {copyStatus === "copied"
          ? "Copied"
          : copyStatus === "failed"
            ? "Copy failed"
            : "Copy verification bundle"}
      </button>
    </section>
  );

  if (variant === "landing") {
    return (
      <div className="border-b border-border bg-bg/95">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">{card}</div>
      </div>
    );
  }

  return card;
}
