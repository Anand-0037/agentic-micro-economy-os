import { motion } from "framer-motion";

import type { VerifiableLog } from "../hooks/useAmeo";
import { zeroGReceiptUrl } from "../lib/zeroG";

type OnChainPulseProps = {
  logs: VerifiableLog[];
  loading: boolean;
  error?: string | null;
  explorerBase: string;
  zeroGExplorerBase: string;
  onRefresh: () => void;
  onTriggerCycle: () => Promise<void>;
};

export function OnChainPulse({
  logs,
  loading,
  error,
  explorerBase,
  zeroGExplorerBase,
  onRefresh,
  onTriggerCycle,
}: OnChainPulseProps) {
  const logsState: "loading" | "empty" | "error" | "ready" = error
    ? "error"
    : loading
      ? "loading"
      : logs.length
        ? "ready"
        : "empty";

  return (
    <div className="neo-card p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-warm">
            Decision Stream
          </p>
          <p className="mt-2 text-sm text-warm">
            Verifiable actions read directly from the AgentIdentity contract.
          </p>
        </div>
        <button
          className="neo-button h-10 bg-sand px-4 text-xs font-semibold uppercase tracking-[0.18em] focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
          type="button"
          onClick={onRefresh}
        >
          Refresh Logs
        </button>
      </div>

      {logsState === "loading" && (
        <div className="mt-6 space-y-3" aria-busy="true">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="h-24 rounded-none border-[3px] border-ink bg-sand/60 animate-pulse"
            />
          ))}
        </div>
      )}

      {logsState === "error" && (
        <div className="mt-6 border-[3px] border-ink bg-sand p-4">
          <p className="text-sm font-semibold">Could not load verifiable logs.</p>
          <p className="mt-1 text-xs text-warm">{error}</p>
          <button
            className="neo-button mt-4 h-10 bg-cream px-4 text-xs font-semibold uppercase tracking-[0.18em] focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            type="button"
            onClick={onRefresh}
          >
            Retry
          </button>
        </div>
      )}

      {logsState === "empty" && (
        <div className="mt-6 border-[3px] border-ink bg-sand p-6 text-center">
          <p className="text-sm font-semibold">No verified decisions yet.</p>
          <p className="mt-2 text-xs text-warm">
            Trigger a live cycle to emit the first on-chain log.
          </p>
          <button
            className="neo-button mt-4 h-10 bg-cream px-4 text-xs font-semibold uppercase tracking-[0.18em] focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
            type="button"
            onClick={() => {
              void onTriggerCycle();
            }}
          >
            Trigger Cycle
          </button>
        </div>
      )}

      {logsState === "ready" && (
        <div className="mt-6 space-y-3">
          {logs.map((log) => (
            <motion.div
              key={`${log.txHash}-${log.rationaleHash}`}
              layout
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="border-[3px] border-ink bg-sand p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-3">
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-warm">
                    Reasoning
                  </p>
                  <div className="border-[3px] border-ink bg-cream p-3 text-xs font-mono text-warm">
                    <p className="break-all">
                      {log.metadataUri || "No rationale metadata"}
                    </p>
                    <p className="mt-2 break-all">Hash {log.rationaleHash}</p>
                    {log.dataHash && (
                      <p className="mt-2 break-all">0G {log.dataHash}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-3 md:text-right">
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-warm">
                    Action
                  </p>
                  <div className="border-[3px] border-ink bg-cream p-3">
                    <p className="text-sm font-semibold">{log.actionType}</p>
                    <p className="mt-2 text-xs text-warm">Agent #{log.agentId}</p>
                  </div>
                </div>
              </div>
              {log.txHash && (
                <a
                  className="neo-button mt-4 inline-flex h-10 items-center justify-center bg-cream px-4 text-[0.65rem] font-semibold uppercase tracking-[0.18em] focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                  href={`${explorerBase}/tx/${log.txHash}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  View Transaction
                </a>
              )}
              {log.dataHash && (
                <a
                  className="neo-button mt-3 inline-flex h-10 items-center justify-center bg-sand px-4 text-[0.65rem] font-semibold uppercase tracking-[0.18em] focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-cream"
                  href={zeroGReceiptUrl(zeroGExplorerBase, log.dataHash)}
                  rel="noreferrer"
                  target="_blank"
                >
                  Cognitive Receipt
                </a>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
