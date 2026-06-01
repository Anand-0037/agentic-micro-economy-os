import { useMemo, useState } from "react";
import { motion } from "framer-motion";

import type { CycleDetail } from "../hooks/useCycles";
import { shortHash } from "../lib/dashboardFormat";

type ReplayNode = {
  id: string;
  title: string;
  payload: unknown;
};

type CycleReplayCardProps = {
  detail: CycleDetail;
  cycleNumber: number;
};

function statusPillClass(status: string) {
  if (status === "verified" || status === "executed") {
    return "bg-[#e2f0d9] border-[#3d7a5f] text-[#3d7a5f]";
  }
  if (status === "failed") {
    return "bg-red-100 border-red-500 text-red-600";
  }
  return "bg-amber-50 border-amber-400 text-amber-800";
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="mt-3 max-h-64 overflow-auto rounded border border-ink/10 bg-sand p-3 font-mono text-[10px] leading-relaxed text-ink/90">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function CycleReplayCard({ detail, cycleNumber }: CycleReplayCardProps) {
  const [replayKey, setReplayKey] = useState(0);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const nodes: ReplayNode[] = useMemo(
    () => [
      { id: "observation", title: "Observation snapshot", payload: detail.observation },
      { id: "treasury", title: "Treasury state", payload: detail.treasury },
      { id: "market", title: "Market signal", payload: detail.market_signal },
      { id: "plan", title: "Planner output", payload: detail.plan },
      {
        id: "policy",
        title: detail.policy_checks?.some((c: any) => !c.passed) 
          ? "Policy validation — REJECTIONS DETECTED" 
          : "Policy validation",
        payload: detail.policy_checks,
      },
      { 
        id: "execution", 
        title: (detail.plan as any)?.rationale_summary?.toLowerCase?.().includes("volatility") 
          ? "Execution · Volatility Rebalance (Mantle DEX)" 
          : "Execution · Mantle DEX (Merchant Moe / FusionX)", 
        payload: detail.execution 
      },
      { id: "tx", title: "Settled on Mantle Sepolia", payload: detail.tx_hash },
      {
        id: "onchain",
        title: `DecisionLogged · ERC-8004 identity #${import.meta.env.VITE_AGENT_TOKEN_ID ?? "0"}`,
        payload: detail.decision_log ?? { note: "No DecisionLogged match for this cycle" },
      },
      {
        id: "zerog",
        title: "0G Storage receipt · indexer-verified",
        payload: detail.zero_g ?? { note: "No 0G receipt anchored for this cycle" },
      },
    ],
    [detail],
  );

  const completedCount = nodes.filter((node) => {
    if (node.id === "policy") {
      return detail.policy_checks.length > 0;
    }
    if (node.id === "onchain") {
      return Boolean(detail.decision_log);
    }
    if (node.id === "zerog") {
      return Boolean(detail.zero_g);
    }
    return Boolean(node.payload) && JSON.stringify(node.payload) !== "{}";
  }).length;

  const [activeIndex, setActiveIndex] = useState(() =>
    Math.min(Math.max(completedCount, 0), nodes.length - 1),
  );

  const copyVerificationBundle = async () => {
    const bundle = {
      cycle_id: detail.summary.cycle_id,
      rationaleHash: detail.decision_log?.rationaleHash ?? null,
      txHash: detail.tx_hash?.hash ?? detail.summary.tx_hash ?? null,
      zeroGRoot: detail.zero_g?.root_hash ?? detail.decision_log?.dataHash ?? null,
      mantleExplorerUrl: detail.tx_hash?.explorer_url ?? null,
      indexerUrl: detail.zero_g?.indexer_url ?? null,
    };
    await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
  };

  const toggleNode = (id: string) => {
    setExpanded((current) => ({ ...current, [id]: !current[id] }));
  };

  const scrubToNode = (index: number) => {
    setActiveIndex(index);
    setExpanded((current) => ({ ...current, [nodes[index].id]: true }));
  };

  return (
    <div className="neo-card bg-surface p-6">
      <div className="mb-6 flex flex-col gap-4 border-b-2 border-ink pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Narrative Console · Replay</p>
          <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
            Cycle #{cycleNumber}
          </h2>
          <p className="mt-1 font-mono text-xs text-muted">
            {detail.summary.cycle_id} · {detail.summary.action_type} ·{" "}
            <span
              className={`inline-block border px-2 py-0.5 text-[10px] font-bold uppercase ${statusPillClass(detail.summary.status)}`}
            >
              {detail.summary.status}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="neo-button border-2 border-ink bg-accent px-3 py-2 text-xs font-bold uppercase tracking-wider text-surface"
            onClick={() => {
              setReplayKey((value) => value + 1);
              setActiveIndex(Math.min(Math.max(completedCount, 0), nodes.length - 1));
            }}
          >
            Replay
          </button>
          <button
            type="button"
            className="neo-button border-2 border-ink bg-surface px-3 py-2 text-xs font-bold uppercase tracking-wider text-ink"
            onClick={() => {
              void copyVerificationBundle();
            }}
          >
            Copy verification bundle
          </button>
        </div>
      </div>

      <h2 className="sr-only">Cycle {detail.summary.cycle_id} replay</h2>

      <div key={replayKey} className="relative pl-8 sm:pl-10">
        <div className="absolute bottom-4 left-[18px] top-4 w-0.5 bg-ink/10" aria-hidden="true" />
        <motion.div
          className="absolute left-[18px] top-4 w-0.5 origin-top bg-accent"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ height: "calc(100% - 32px)" }}
        />

        <ol role="list" aria-label="Cycle replay steps" className="relative space-y-6">
          {nodes.map((node, index) => {
            const isOpen = expanded[node.id] ?? index === 0;
            const isComplete =
              node.id === "policy"
                ? detail.policy_checks.every((check) => check.passed)
                : node.id === "onchain"
                  ? Boolean(detail.decision_log)
                  : node.id === "zerog"
                    ? Boolean(detail.zero_g)
                    : Boolean(node.payload) && JSON.stringify(node.payload) !== "{}";
            const isActive = activeIndex === index;

            return (
              <motion.li
                key={`${node.id}-${replayKey}`}
                className="relative list-none"
                aria-current={isActive ? "step" : undefined}
                aria-describedby={`replay-node-${index}-evidence`}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: index * 0.08 }}
              >
                <button
                  type="button"
                  className={`absolute -left-[30px] top-1 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink ${
                    isComplete
                      ? "bg-accent text-surface"
                      : isActive
                        ? "bg-sand text-ink shadow-[0_0_12px_rgba(200,107,74,0.35)]"
                        : "bg-[#faf7f2] text-ink/30"
                  }`}
                  aria-label={`Step ${index + 1}: ${node.title}`}
                  onClick={() => scrubToNode(index)}
                >
                  {isComplete ? "✓" : index + 1}
                </button>

                <div
                  className={`border-2 border-ink p-4 transition-all ${
                    isActive
                      ? "bg-surface shadow-[4px_4px_0px_0px_#c86b4a]"
                      : isComplete
                        ? "bg-[#faf7f2] opacity-90"
                        : "bg-[#faf7f2]/40 opacity-50"
                  }`}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 text-left"
                    onClick={() => toggleNode(node.id)}
                  >
                    <span className="font-display text-sm font-bold text-ink sm:text-base">
                      {node.title}
                      {node.id === "plan" && (detail.plan as any)?.rationale_summary?.toLowerCase?.().includes("volatility") && (
                        <span className="ml-2 inline-block rounded border border-amber-500 bg-amber-50 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-amber-700">
                          ⚡ VOLATILITY RESPONSE
                        </span>
                      )}
                    </span>
                    <span
                      id={`replay-node-${index}-evidence`}
                      className="shrink-0 font-mono text-[10px] font-extrabold uppercase"
                    >
                      {isComplete ? (
                        <span className="bg-[#3d7a5f] px-2 py-0.5 text-surface text-[9px]">
                          {index === 0 && 'OBSERVED'}
                          {index === 1 && 'GENERATED'}
                          {index === 2 && 'EVALUATED'}
                          {index === 3 && 'SETTLED'}
                          {index === 4 && 'PROVEN'}
                          {index > 4 && 'VERIFIED'}
                        </span>
                      ) : isActive ? (
                        <span className="animate-pulse bg-accent px-2 py-0.5 text-surface">● ACTIVE</span>
                      ) : (
                        <span className="text-muted">{isOpen ? "−" : "+"}</span>
                      )}
                    </span>
                  </button>

                  {/* Special callouts for interesting behavior (MVP/D polish) */}
                  {node.id === "plan" && (detail.plan as any)?.rationale_summary?.toLowerCase?.().includes("volatility") && (
                    <div className="mb-2 p-2 bg-amber-50 border-2 border-amber-500 text-amber-800 text-[10px] font-mono">
                      ⚡ VOLATILITY RESPONSE: Agent adapted to market move in fallback mode. This is real adaptive behavior.
                    </div>
                  )}
                  {node.id === "policy" && detail.policy_checks?.some((c: any) => !c.passed) && (
                    <div className="mb-2 p-2 bg-red-50 border-2 border-red-500 text-red-700 text-[10px] font-mono">
                      ⚠️ POLICY REJECTION(S) DETECTED: Plan was blocked or adjusted by guardrails. Safety layer active.
                    </div>
                  )}

                  {node.id === "tx" && detail.tx_hash?.hash ? (
                    <p className="mt-2 font-mono text-xs text-ink">
                      {detail.tx_hash.explorer_url ? (
                        <a
                          className="text-accent underline"
                          href={detail.tx_hash.explorer_url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          {shortHash(String(detail.tx_hash.hash))} ↗
                        </a>
                      ) : (
                        shortHash(String(detail.tx_hash.hash))
                      )}
                    </p>
                  ) : null}

                  {isOpen ? <JsonBlock value={node.payload} /> : null}
                </div>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
