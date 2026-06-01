import type { CycleData } from "../components/CognitionTimeline";
import type { CycleDetail } from "../hooks/useCycles";
import { executionTargetLabel, runtimeConfig } from "./runtimeConfig";

export function mapCycleDetailToCycleData(
  detail: CycleDetail,
  options: {
    explorerBase: string;
    treasuryEoa: string;
    agentIdentityAddress: string;
  },
): CycleData {
  const { plan, policy_checks, observation, execution, tx_hash, summary, decision_log, zero_g } =
    detail;
  const anyReject = policy_checks.some((check) => !check.passed);

  const mappedObservation =
    observation && typeof observation === "object"
      ? {
          balances: observation.balances ?? {},
          gasPriceWei: Number(observation.gas_price_wei ?? 15_000_000_000),
          rpcUrl: observation.rpc_url ?? runtimeConfig.mantleRpcUrl,
          blockNumber: Number(observation.block_number ?? 0),
        }
      : undefined;

  const reasoning =
    plan.rationale || plan.rationale_summary
      ? {
          llmProvider: runtimeConfig.llmProviderLabel,
          model: runtimeConfig.llmModel,
          rationaleHash: String(decision_log?.rationaleHash ?? summary.rationale_hash ?? ""),
          thoughtProcess: String(
            plan.rationale_summary ?? plan.rationale ?? "Cycle executed under policy guardrails.",
          ),
          zeroGHash: String(zero_g?.root_hash ?? decision_log?.dataHash ?? ""),
        }
      : undefined;

  const policy = {
    maxDrawdownLimit: `${(runtimeConfig.volatilityThresholdPct * 100).toFixed(0)}% cap (dynamic)`,
    drawdownPassed: !policy_checks.some(
      (check) => check.rule.toLowerCase().includes("drawdown") && !check.passed,
    ),
    whitelistPassed: !policy_checks.some(
      (check) => check.rule.toLowerCase().includes("whitelist") && !check.passed,
    ),
    tradeSizeLimitUsd: runtimeConfig.maxTradeUsd,
    planApproved: !anyReject,
  };

  const mappedExecution = execution
    ? {
        sender: execution.sender ?? options.treasuryEoa ?? options.agentIdentityAddress,
        targetContract: execution.target_contract ?? executionTargetLabel(),
        actionDescription:
          plan.rationale_summary?.toString() ??
          `${runtimeConfig.executionAdapterLabel}: ${summary.action_type || "swap"}`,
        signingKeyType: runtimeConfig.signingMethod,
        gasEstimateGwei: 28,
      }
    : undefined;

  const tx = tx_hash?.hash ?? summary.tx_hash;
  const settlementBlock = Number(
    tx_hash?.block_number ??
      execution.calldata?.block_number ??
      observation.block_number ??
      0,
  );

  const settlement = tx
    ? {
        txHash: tx,
        blockNumber: settlementBlock,
        verifiedOnChain: true,
        explorerUrl: `${options.explorerBase}/tx/${tx}`,
      }
    : undefined;

  return {
    observation: mappedObservation,
    reasoning,
    policy,
    execution: mappedExecution,
    settlement,
    plan,
  };
}
