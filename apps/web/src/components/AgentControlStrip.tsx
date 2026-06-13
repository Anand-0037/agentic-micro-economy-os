import type { RunnerStatus, StatusResponse, VerifiableLog } from "../hooks/useAmeo";
import { shortAddress, shortHash, timeAgo } from "../lib/dashboardFormat";
import { StatusDot } from "./ui/StatusDot";

type AgentControlStripProps = {
  workerHealthy: boolean;
  workerLoading?: boolean;
  runner: RunnerStatus;
  status?: StatusResponse | null;
  actionLoading: boolean;
  runCycleDisabled?: boolean;
  agentTokenId: string;
  treasuryEoa?: string;
  chainLabel?: string;
  lastLog?: VerifiableLog;
  explorerBase: string;
  onRunCycle: () => Promise<void>;
  hideEmptyStates?: boolean;
};

function lastActionLabel(
  status: StatusResponse | null | undefined,
  lastLog?: VerifiableLog,
): string | null {
  const exec = status?.last_execution;
  if (exec?.tx_hash) {
    return exec.ok ? "Executed on Mantle" : "Execution attempted";
  }
  if (lastLog?.actionType) {
    return lastLog.actionType;
  }
  return null;
}

export function AgentControlStrip({
  workerHealthy,
  workerLoading = false,
  runner,
  status,
  actionLoading,
  runCycleDisabled = false,
  agentTokenId,
  treasuryEoa,
  chainLabel = "Mantle Sepolia",
  lastLog,
  explorerBase,
  onRunCycle,
  hideEmptyStates = false,
}: AgentControlStripProps) {
  const lastCycleWhen = timeAgo(runner.last_cycle_at);
  const actionLabel = lastActionLabel(status, lastLog);
  const txHash = status?.last_execution?.tx_hash ?? lastLog?.txHash;

  let zoneState: "loading" | "bootstrap" | "ready" | "error";
  if (workerLoading) {
    zoneState = "loading";
  } else if (!workerHealthy) {
    zoneState = "error";
  } else if (!lastCycleWhen && !actionLabel) {
    zoneState = "bootstrap";
  } else {
    zoneState = "ready";
  }

  if (hideEmptyStates && (zoneState === "bootstrap" || zoneState === "error")) {
    zoneState = "ready";
  }

  return (
    <section
      id="agent-control"
      className="soft-card border-accent/20 p-5 sm:p-6"
      aria-labelledby="agent-control-heading"
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Agent status</p>
            <h2
              id="agent-control-heading"
              className="mt-1 font-display text-xl font-semibold text-ink sm:text-2xl"
            >
              {zoneState === "loading"
                ? "Checking worker…"
                : zoneState === "error"
                  ? "Worker unavailable"
                  : zoneState === "bootstrap"
                    ? "Ready for first cycle"
                    : "Agent active"}
            </h2>
          </div>

          {zoneState === "loading" ? (
            <p className="text-sm text-muted">
              Connecting to the Python worker… (Render cold starts can take ~30s; retrying automatically)
            </p>
          ) : zoneState === "error" ? (
            <p className="text-sm text-muted">
              Cannot reach the worker API after retries. Check VITE_WORKER_URL, run scripts/warm-worker.sh on a 14-min ping, or open ⚙ to point at a different endpoint.
            </p>
          ) : zoneState === "bootstrap" ? (
            <p className="text-sm text-muted">
              Press Run cycle to observe, plan, execute on Mantle, and log a verifiable
              decision.
            </p>
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Worker
                </dt>
                <dd className="mt-1 flex items-center gap-2 font-medium text-ink">
                  <StatusDot ok={workerHealthy} />
                  Healthy
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Last cycle
                </dt>
                <dd className="mt-1 font-medium tabular-nums text-ink">
                  {lastCycleWhen ?? "Just now"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Last action
                </dt>
                <dd className="mt-1 font-medium text-ink">
                  {actionLabel ?? "Cycle completed"}
                  {txHash ? (
                    <>
                      {" · "}
                      <a
                        className="font-mono text-xs text-accent hover:underline"
                        href={`${explorerBase}/tx/${txHash}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {shortHash(txHash)} ↗
                      </a>
                    </>
                  ) : null}
                </dd>
              </div>
            </dl>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:min-w-[11rem]">
          <button
            type="button"
            className="btn-primary h-12 px-6 text-base font-semibold disabled:opacity-60"
            disabled={actionLoading || runCycleDisabled}
            onClick={() => {
              void onRunCycle();
            }}
          >
            {actionLoading ? "Running…" : runCycleDisabled ? "Live worker unavailable" : "Run cycle"}
          </button>
          <p className="text-center text-[0.65rem] text-muted">
            AMEO #{agentTokenId}
            {treasuryEoa ? (
              <>
                {" · agent signer "}
                <span className="font-mono">{shortAddress(treasuryEoa)}</span>
              </>
            ) : null}{" "}
            · {chainLabel}
            <br />
            <span className="text-[0.6rem]">Cycles sign server-side — not your connected wallet</span>
          </p>
        </div>
      </div>
    </section>
  );
}
