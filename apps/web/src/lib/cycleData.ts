import type { CycleData } from "../components/CognitionTimeline";
import type { CycleDetail } from "../hooks/useCycles";
import { cognitionStepState, deriveCycleOutcome, resolvePlannerLabel } from "./cycleOutcome";
import { executionTargetLabel, runtimeConfig } from "./runtimeConfig";

type AmeoConfigLike = {
  max_drawdown_pct?: number;
  max_position_usd?: number;
  asset_whitelist?: string[];
};

export function mapCycleDetailToCycleData(
  detail: CycleDetail,
  options: {
    explorerBase: string;
    treasuryEoa: string;
    agentIdentityAddress: string;
    ameoConfig?: Partial<AmeoConfigLike>;
    activeLlmProvider?: string | null;
  },
): CycleData {
  const { plan, policy_checks, observation, execution, tx_hash, summary, decision_log, zero_g } =
    detail;
  const outcome = deriveCycleOutcome(detail);
  const anyReject = policy_checks.some((check) => !check.passed);
  const executionOk = execution?.ok === true;
  const tx = tx_hash?.hash ?? summary.tx_hash;

  const mappedObservation =
    observation && typeof observation === "object"
      ? {
          balances: observation.balances ?? {},
          gasPriceWei: Number(observation.gas_price_wei ?? 15_000_000_000),
          rpcUrl: observation.rpc_url ?? runtimeConfig.mantleRpcUrl,
          blockNumber: Number(observation.block_number ?? 0),
        }
      : undefined;

  const plannerLabel = resolvePlannerLabel(detail, options.activeLlmProvider);
  const zeroGHash = "";

  const reasoning =
    plan.rationale || plan.rationale_summary
      ? {
          llmProvider: plannerLabel,
          model: plannerLabel.includes("local_rules") ? "rules@mantis-v1" : runtimeConfig.llmModel,
          rationaleHash: String(decision_log?.rationaleHash ?? summary.rationale_hash ?? ""),
          thoughtProcess: String(
            plan.rationale_summary ?? plan.rationale ?? "Cycle executed under policy guardrails.",
          ),
          zeroGHash,
        }
      : undefined;

  const cfg = options.ameoConfig;
  const policy = {
    maxDrawdownLimit: cfg?.max_drawdown_pct
      ? `${(cfg.max_drawdown_pct * 100).toFixed(0)}% cap`
      : `${(runtimeConfig.volatilityThresholdPct * 100).toFixed(0)}% cap (dynamic)`,
    drawdownPassed: !policy_checks.some(
      (check) => check.rule.toLowerCase().includes("drawdown") && !check.passed,
    ),
    whitelistPassed: !policy_checks.some(
      (check) => check.rule.toLowerCase().includes("whitelist") && !check.passed,
    ),
    tradeSizeLimitUsd: cfg?.max_position_usd || runtimeConfig.maxTradeUsd,
    planApproved: !anyReject,
  };

  const executionDescription =
    outcome.policyBlocked
      ? "Policy blocked — no DEX execution attempted"
      : outcome.isTreasuryPing
        ? "treasury_ping — degraded path (thin testnet liquidity)"
        : executionOk
          ? String(plan.rationale_summary ?? `${runtimeConfig.executionAdapterLabel}: ${summary.action_type || "swap"}`)
          : String(execution?.error ?? "Execution failed — no settlement tx");

  const mappedExecution = execution
    ? {
        sender: execution.sender ?? options.treasuryEoa ?? options.agentIdentityAddress,
        targetContract: execution.target_contract ?? executionTargetLabel(),
        actionDescription: executionDescription,
        signingKeyType: runtimeConfig.signingMethod,
        gasEstimateGwei: 28,
        ok: executionOk,
      }
    : undefined;

  const settlementBlock = Number(
    tx_hash?.block_number ?? execution.calldata?.block_number ?? observation.block_number ?? 0,
  );

  const settlement =
    tx && (executionOk || outcome.policyBlocked)
      ? {
          txHash: tx,
          blockNumber: settlementBlock,
          verifiedOnChain: executionOk && Boolean(tx),
          explorerUrl: `${options.explorerBase}/tx/${tx}`,
        }
      : undefined;

  const maxCompletedStep = [0, 1, 2, 3, 4].reduce((max, step) => {
    const hasData =
      step === 0
        ? Boolean(mappedObservation)
        : step === 1
          ? Boolean(reasoning)
          : step === 2
            ? Boolean(policy)
            : step === 3
              ? Boolean(mappedExecution)
              : Boolean(settlement);
    const state = cognitionStepState(step, outcome, hasData);
    if (state === "complete" || state === "degraded" || state === "failed") {
      return Math.max(max, step);
    }
    return max;
  }, 0);

  return {
    observation: mappedObservation,
    reasoning,
    policy,
    execution: mappedExecution,
    settlement,
    plan,
    outcome,
    maxCompletedStep,
  };
}
