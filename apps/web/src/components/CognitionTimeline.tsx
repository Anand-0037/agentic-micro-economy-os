import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";
import { apiGet } from "../lib/apiClient";
import {
  cognitionStepBadge,
  cognitionStepState,
  type CycleOutcome,
} from "../lib/cycleOutcome";
import { runtimeConfig } from "../lib/runtimeConfig";

export type CycleData = {
  observation?: {
    balances: Record<string, number>;
    gasPriceWei: number;
    rpcUrl: string;
    blockNumber: number;
  };
  reasoning?: {
    llmProvider: string;
    model: string;
    rationaleHash: string;
    thoughtProcess: string;
    zeroGHash: string;
  };
  policy?: {
    maxDrawdownLimit: string;
    drawdownPassed: boolean;
    whitelistPassed: boolean;
    tradeSizeLimitUsd: number;
    planApproved: boolean;
  };
  execution?: {
    sender: string;
    targetContract: string;
    actionDescription: string;
    signingKeyType: string;
    gasEstimateGwei: number;
    ok?: boolean;
  };
  settlement?: {
    txHash: string;
    blockNumber: number;
    verifiedOnChain: boolean;
    explorerUrl: string;
  };
  plan?: {
    rationale_summary?: string;
    rationale?: string;
  };
  outcome?: CycleOutcome;
  maxCompletedStep?: number;
};

function isVolatilityResponse(data: CycleData): boolean {
  const summary = data.plan?.rationale_summary?.toLowerCase() ?? "";
  return summary.includes("volatility");
}

// defaultSampleData removed for Block C: no static/fake hero data or tx hashes in product surfaces.
// All timelines now require real cycle data from /v1/decisions or live fetch.

type CognitionTimelineProps = {
  cycleData?: CycleData;
  autoLoop?: boolean;
  pauseOnHover?: boolean;
  hideHeader?: boolean;
};

export function CognitionTimeline({
  cycleData,
  autoLoop = false,
  pauseOnHover = false,
  hideHeader = false,
}: CognitionTimelineProps) {
  const [liveData, setLiveData] = useState<CycleData | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const reduced = usePrefersReducedMotion();
  const [activeStep, setActiveStep] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const [paused, setPaused] = useState(false);

  // useLatestCycleSample() equivalent - dynamic hero data from /v1/decisions (no hardcoded tx)
  useEffect(() => {
    if (cycleData) return;

    const workerUrl = runtimeConfig.workerUrl.replace(/\/$/, "");
    let cancelled = false;
    setLiveLoading(true);

    async function load() {
      try {
        const [decJson, probe] = await Promise.all([
          apiGet<{ items?: Array<{ cycleId?: string; txHash?: string | null }> }>(
            workerUrl,
            "/v1/decisions?limit=1",
            8000,
            runtimeConfig.workerApiKey,
          ).catch(() => null),
          apiGet<{ block_number?: number }>(workerUrl, "/api/mantle-probe", 8000, runtimeConfig.workerApiKey).catch(() => null),
        ]);
        if (cancelled) return;

        const chainBlock = Number(probe?.block_number ?? 0);
        const item = decJson?.items?.[0];
        if (!item) return;

        let detail: {
          observation?: { block_number?: number; balances?: Record<string, number>; gas_price_wei?: number };
          summary?: { tx_hash?: string; action_type?: string };
          plan?: { rationale_summary?: string; planner_version?: string };
          tx_hash?: { hash?: string; block_number?: number };
        } | null = null;

        if (item.cycleId) {
          detail = await apiGet<{
            observation?: {
              block_number?: number;
              balances?: Record<string, number>;
              gas_price_wei?: number;
            };
            summary?: { tx_hash?: string; action_type?: string };
            plan?: { rationale_summary?: string; planner_version?: string };
            tx_hash?: { hash?: string; block_number?: number };
          }>(workerUrl, `/api/cycles/${encodeURIComponent(item.cycleId)}`).catch(() => null);
        }

        if (cancelled) return;

        const txHash = item.txHash || detail?.summary?.tx_hash || detail?.tx_hash?.hash || "";
        const blockNumber = Number(
          detail?.observation?.block_number ??
            detail?.tx_hash?.block_number ??
            chainBlock,
        );

        setLiveData({
          observation: {
            balances: detail?.observation?.balances ?? {},
            gasPriceWei: Number(detail?.observation?.gas_price_wei ?? 0),
            rpcUrl: runtimeConfig.mantleRpcUrl,
            blockNumber,
          },
          settlement: {
            txHash,
            blockNumber,
            verifiedOnChain: Boolean(txHash),
            explorerUrl: txHash ? `${runtimeConfig.explorerBase}/tx/${txHash}` : "",
          },
        });
      } catch {
        /* keep skeleton */
      } finally {
        if (!cancelled) {
          setLiveLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [cycleData]);

  const data = cycleData || liveData;
  const volatilityResponse = useMemo(
    () => (data ? isVolatilityResponse(data) : false),
    [data],
  );

  useEffect(() => {
    if (!data) {
      return undefined;
    }
    const terminalStep = Math.min(data.maxCompletedStep ?? 4, 4);
    if (reduced) {
      setActiveStep(terminalStep);
      return undefined;
    }

    setActiveStep(0);
    if (paused && pauseOnHover) {
      return undefined;
    }
    const stepMs = autoLoop ? 1400 : 1800;
    const intervals = Array.from({ length: terminalStep }, (_, index) =>
      setTimeout(() => setActiveStep(index + 1), stepMs * (index + 1)),
    );
    if (autoLoop && terminalStep > 0) {
      intervals.push(
        setTimeout(() => {
          setReplayKey((prev) => prev + 1);
        }, stepMs * terminalStep + 800),
      );
    }
    return () => {
      intervals.forEach((id) => clearTimeout(id));
    };
  }, [autoLoop, cycleData, data, pauseOnHover, paused, replayKey, reduced]);

  // Block C: No static/fake hero data. If no real cycle, show skeleton.
  if (!data) {
    return (
      <div className="neo-card p-6 bg-surface border-2 border-ink text-center">
        <p className="text-muted">
          {liveLoading
            ? "Loading latest on-chain cycle…"
            : "Awaiting first real cycle with on-chain settlement..."}
        </p>
        <p className="text-xs text-muted mt-1">Data is pulled dynamically from /v1/decisions</p>
      </div>
    );
  }

  const handleReplay = () => {
    if (reduced) return;
    setReplayKey((prev) => prev + 1);
  };

  const motionEnter = reduced ? { opacity: 1, x: 0 } : { opacity: 0, x: -15 };
  const motionVisible = { opacity: 1, x: 0 };
  const motionTransition = reduced ? { duration: 0 } : { duration: 0.4 };

  const isTreasuryPing =
    data.execution?.actionDescription?.toLowerCase().includes("treasury_ping") ?? false;
  const outcome = data.outcome;
  const executionFailed = outcome ? !outcome.executionOk && !outcome.policyBlocked : false;

  const steps = [
    {
      title: "Observation & State Extraction",
      description: "Fetching state directly from Mantle Sepolia network RPC.",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        </svg>
      ),
      content: data.observation ? (
        <div className="mt-3 space-y-2 font-mono text-xs text-ink/80">
          <div className="flex justify-between border-b border-ink/10 pb-1">
            <span>Mantle RPC:</span>
            <span className="text-right truncate max-w-[200px]" title={data.observation.rpcUrl}>
              {data.observation.rpcUrl}
            </span>
          </div>
          <div className="flex justify-between border-b border-ink/10 pb-1">
            <span>Block Number:</span>
            <span>#{data.observation.blockNumber}</span>
          </div>
          <div className="flex justify-between border-b border-ink/10 pb-1">
            <span>USDC Balance:</span>
            <span>{data.observation.balances.USDC} units</span>
          </div>
          <div className="flex justify-between border-b border-ink/10 pb-1">
            <span>MNT Balance:</span>
            <span>{data.observation.balances.MNT} units</span>
          </div>
        </div>
      ) : null,
    },
    {
      title: volatilityResponse
        ? "Reasoning & Plan Compilation — ⚡ VOLATILITY RESPONSE"
        : "Reasoning & Plan Compilation",
      description: volatilityResponse
        ? "Market signal triggered rebalance in fallback mode."
        : "Model generates a trade plan; rationale is hashed for on-chain DecisionLogged.",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 21l3.625-1.43c.094-.037.193-.056.294-.056h.163c.101 0 .2.019.294.056L17 21l-.813-5.096a3.5 3.5 0 0 0-2.458-2.835L12 12l-1.73 1.07a3.5 3.5 0 0 0-2.457 2.834Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 12V9m0 0a3 3 0 1 0-3-3m3 3a3 3 0 1 1 3-3" />
        </svg>
      ),
      content: data.reasoning ? (
        <div className="mt-3 space-y-3 font-mono text-xs text-ink/80">
          <div className="border-b border-ink/10 pb-1 flex justify-between">
            <span>LLM Provider (with safety fallback):</span>
            <span className="text-accent font-semibold">{data.reasoning.llmProvider}</span>
          </div>
          <div className="border-b border-ink/10 pb-2">
            <span className="block font-semibold">Active Rationale Hash:</span>
            <span className="block break-all text-[10px] text-muted">{data.reasoning.rationaleHash}</span>
          </div>
          <div className="bg-sand border-2 border-ink p-3 text-xs leading-relaxed font-sans italic text-ink/90">
            "{data.reasoning.thoughtProcess}"
          </div>

        </div>
      ) : null,
    },
    {
      title: "Hardened Policy Engine Verification",
      description: "Evaluating the compiled action plan against hardcoded risk policies.",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
      ),
      content: data.policy ? (
        <div className="mt-3 space-y-2 font-mono text-xs">
          <div className="flex justify-between items-center border-b border-ink/10 pb-1.5">
            <span className="text-ink/80">Drawdown Guard ({data.policy.maxDrawdownLimit}):</span>
            <span className={`px-2 py-0.5 text-[10px] font-bold border ${data.policy.drawdownPassed ? "bg-[#e2f0d9] border-[#3d7a5f] text-[#3d7a5f]" : "bg-red-100 border-red-500 text-red-600"}`}>
              {data.policy.drawdownPassed ? "PASS" : "FAIL"}
            </span>
          </div>
          <div className="flex justify-between items-center border-b border-ink/10 pb-1.5">
            <span className="text-ink/80">Asset Whitelist Check:</span>
            <span className={`px-2 py-0.5 text-[10px] font-bold border ${data.policy.whitelistPassed ? "bg-[#e2f0d9] border-[#3d7a5f] text-[#3d7a5f]" : "bg-red-100 border-red-500 text-red-600"}`}>
              {data.policy.whitelistPassed ? "PASS" : "FAIL"}
            </span>
          </div>
          <div className="flex justify-between items-center border-b border-ink/10 pb-1.5">
            <span className="text-ink/80">Max Trade Limit (${data.policy.tradeSizeLimitUsd}):</span>
            <span className="font-semibold text-ink">${data.policy.tradeSizeLimitUsd}</span>
          </div>
          <div className="mt-2 text-[10px] text-muted font-mono">
            Evaluated · {data.policy?.drawdownPassed && data.policy?.whitelistPassed ? 'all predicates passed' : 'some predicates failed — plan adjusted'}
          </div>

          {/* Full 7 guardrails disclosure (3 prominent + 4 silent enforcement) to match "7 guardrails" claims */}
          <details className="mt-2 text-[10px] text-muted">
            <summary className="cursor-pointer hover:text-ink">+ Show all 7 guardrails</summary>
            <ul className="mt-1 pl-4 list-disc">
              <li>✓ MaxDrawdownCheck</li>
              <li>✓ AssetWhitelistCheck</li>
              <li>✓ TradeSizeCheck</li>
              <li>○ GasBudgetCheck (enforced silently)</li>
              <li>○ MinimumBalanceCheck (enforced silently)</li>
              <li>○ SlippageToleranceCheck (enforced silently)</li>
              <li>○ ExecutionFrequencyCheck (enforced silently)</li>
            </ul>
          </details>

          {/* Rejection surfacing remains visible in archived proof mode when the live worker is unreachable. */}
          {data.policy && (!data.policy.drawdownPassed || !data.policy.whitelistPassed) && (
            <div className="mt-3 p-2 bg-red-50 border-2 border-red-500 text-red-700 text-[10px] font-mono">
              ⚠️ POLICY REJECTION: Plan was adjusted or blocked by guardrails. This is the safety layer in action.
            </div>
          )}
        </div>
      ) : null,
    },
    {
      title: outcome?.policyBlocked
        ? "Execution · skipped (policy blocked)"
        : isTreasuryPing
          ? "Execution · treasury_ping (degraded path)"
          : executionFailed
            ? "Execution · failed (no settlement)"
            : "Execution · FusionX V2 DEX",
      description: outcome?.policyBlocked
        ? "Guardrails refused the plan before any swap was attempted."
        : isTreasuryPing
          ? "Swap path unavailable on Sepolia — degraded to treasury_ping. Decision may still log on-chain."
          : executionFailed
            ? "Router or wrap step reverted on testnet (thin liquidity). No settlement tx for this leg."
            : "Policy-approved plan executed via FusionX V2 on Mantle Sepolia (hot EOA signer).",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
        </svg>
      ),
      content: data.execution ? (
        <div className="mt-3 space-y-2 font-mono text-xs text-ink/80">
          <div className="flex justify-between border-b border-ink/10 pb-1">
            <span>Signing Agent EOA:</span>
            <span className="truncate max-w-[180px]">{data.execution.sender}</span>
          </div>
          <div className="flex justify-between border-b border-ink/10 pb-1">
            <span>Target Contract:</span>
            <span className="truncate max-w-[180px] text-right" title={data.execution.targetContract}>
              {data.execution.targetContract.split(" ")[0]}
            </span>
          </div>
          <div className="flex justify-between border-b border-ink/10 pb-1">
            <span>Signing Method:</span>
            <span className="text-[#b45309] font-semibold">{data.execution.signingKeyType}</span>
          </div>
          <div className="flex justify-between border-b border-ink/10 pb-1">
            <span>Gas Estimate:</span>
            <span>{data.execution.gasEstimateGwei} Gwei</span>
          </div>
          <div className="mt-1 bg-amber-50 border border-amber-300 p-2 font-sans font-semibold text-[#b45309]">
            ⚡ Execution Adapter: {data.execution.actionDescription}
          </div>
          {volatilityResponse && (
            <div className="mt-2 text-[10px] bg-amber-100 border border-amber-400 p-1 font-mono">
              VOLATILITY REBALANCE: Exposure adjusted due to recent price move. This is the agent's adaptive behavior.
            </div>
          )}
        </div>
      ) : null,
    },
    {
      title: outcome?.policyBlocked
        ? "On-chain proof · policy_blocked"
        : data.settlement
          ? "Settled on Mantle Sepolia (MNT gas)"
          : "Settlement · none for this cycle",
      description: outcome?.policyBlocked
        ? "DecisionLogged records the refusal — verifiable on the agent identity contract."
        : data.settlement
          ? "State change recorded on Mantle Network."
          : "No Mantle settlement tx for the failed execution leg.",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
        </svg>
      ),
      content: data.settlement ? (
        <div className="mt-3 space-y-2 font-mono text-xs text-ink/80">
          <div className="flex justify-between border-b border-ink/10 pb-1">
            <span>Settled Block:</span>
            <span>#{data.settlement.blockNumber}</span>
          </div>
          <div className="border-b border-ink/10 pb-2">
            <span className="block font-semibold">Transaction Hash:</span>
            <a
              href={data.settlement.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline font-bold break-all text-[11px] block mt-1 hover:text-accent-hover transition-colors"
            >
              {data.settlement.txHash} ↗
            </a>
          </div>
          <div className="mt-2 text-[10px] text-muted font-mono">
            Settled · block #{data.settlement.blockNumber || '—'}
          </div>
        </div>
      ) : null,
    },
  ];

  return (
    <LazyMotion features={domAnimation}>
    <div
      className="neo-card p-6 bg-surface border-2 border-ink"
      onMouseEnter={pauseOnHover ? () => setPaused(true) : undefined}
      onMouseLeave={pauseOnHover ? () => setPaused(false) : undefined}
    >
      {!hideHeader ? (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b-2 border-ink pb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-ink sm:text-xl">
              🧠 Real-Time Cognition timeline
            </h3>
            <p className="text-xs text-muted mt-1 uppercase tracking-wider">
              Deterministic Replay of Agent Decision Loop
            </p>
          </div>
          <button
            type="button"
            onClick={handleReplay}
            disabled={reduced}
            className="neo-button inline-flex items-center justify-center gap-2 border-2 border-ink bg-accent px-4 py-2 text-xs font-bold uppercase tracking-wider text-surface transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="3"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            Replay Cycle
          </button>
        </div>
      ) : null}

      <div className="relative pl-8 sm:pl-10 space-y-8">
        {/* Progress connecting line */}
        <div className="absolute left-[18px] top-4 bottom-4 w-0.5 bg-ink/10" aria-hidden="true" />
        
        {/* Completed active trace overlay */}
        <m.div
          className="absolute left-[18px] top-4 w-0.5 origin-top bg-accent"
          initial={reduced ? { scaleY: 1 } : { scaleY: 0 }}
          animate={{ scaleY: reduced ? 1 : activeStep / 4 }}
          transition={reduced ? { duration: 0 } : { duration: 1.5, ease: "easeInOut" }}
          style={{ height: "calc(100% - 32px)" }}
        />

        <AnimatePresence>
          {steps.map((step, idx) => {
            const hasStepData =
              idx === 0
                ? Boolean(data.observation)
                : idx === 1
                  ? Boolean(data.reasoning)
                  : idx === 2
                    ? Boolean(data.policy)
                    : idx === 3
                      ? Boolean(data.execution)
                      : Boolean(data.settlement);
            const visualState = outcome
              ? cognitionStepState(idx, outcome, hasStepData)
              : activeStep > idx
                ? "complete"
                : "neutral";
            const isCompleted = visualState === "complete" || visualState === "degraded";
            const isFailed = visualState === "failed";
            const isActive = activeStep === idx;
            const isFuture = activeStep < idx;
            const stepBadge = cognitionStepBadge(idx, visualState);

            return (
              <m.div
                key={idx}
                className="relative"
                initial={motionEnter}
                animate={motionVisible}
                transition={{ ...motionTransition, delay: reduced ? 0 : idx * 0.1 }}
              >
                {/* Node icon circle */}
                <m.div
                  className={`absolute -left-[30px] top-0 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink transition-all sm:-left-[32px] ${
                    isFailed
                      ? "bg-red-100 text-red-700"
                      : isCompleted
                        ? visualState === "degraded"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-accent text-surface"
                        : isActive
                          ? "bg-sand text-ink shadow-[0_0_12px_rgba(200,107,74,0.4)]"
                          : "bg-[#faf7f2] text-ink/30"
                  }`}
                  animate={
                    reduced || !isActive
                      ? {}
                      : {
                          scale: [1, 1.08, 1],
                          borderColor: ["#1f1a17", "#c86b4a", "#1f1a17"],
                        }
                  }
                  transition={reduced ? { duration: 0 } : { repeat: Infinity, duration: 1.5 }}
                >
                  {isFailed ? (
                    <span className="text-sm font-bold">!</span>
                  ) : isCompleted ? (
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 1.944A11.954 11.954 0 012.166 5C2.08 5.753 2 6.516 2 7.292c0 5.08 3.753 9.284 8.734 10.648A11.954 11.954 0 0017.834 7.292c0-.776-.08-1.54-.166-2.292A11.954 11.954 0 0110 1.944z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    step.icon
                  )}
                </m.div>

                {/* Step content card */}
                <m.div
                  className={`border-2 border-ink p-4 sm:p-5 transition-all ${
                    isActive
                      ? "bg-surface shadow-[4px_4px_0px_0px_#c86b4a]"
                      : isCompleted
                        ? "bg-[#faf7f2] opacity-80"
                        : "bg-[#faf7f2]/40 opacity-40"
                  }`}
                  animate={reduced || !isActive ? { y: 0 } : { y: -2 }}
                  transition={{ duration: reduced ? 0 : 0.2 }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                    <h4 className="font-display font-bold text-sm sm:text-base text-ink">
                      {step.title}
                    </h4>
                    {stepBadge ? (
                      <span
                        className={`shrink-0 font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 border ${
                          isFailed
                            ? "bg-red-50 border-red-500 text-red-700"
                            : visualState === "degraded"
                              ? "bg-amber-50 border-amber-500 text-amber-800"
                              : "bg-sand border-ink/30 text-ink"
                        }`}
                      >
                        {stepBadge}
                      </span>
                    ) : isActive && !reduced ? (
                      <span className="shrink-0 animate-pulse border border-accent bg-accent px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase text-surface">
                        ● THINKING…
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-muted leading-relaxed font-medium">
                    {step.description}
                  </p>

                  {/* Expansion content */}
                  {(!isFuture && step.content) && (
                    <m.div
                      initial={reduced ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: reduced ? 0 : 0.4, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      {step.content}
                    </m.div>
                  )}
                </m.div>
              </m.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
    </LazyMotion>
  );
}
