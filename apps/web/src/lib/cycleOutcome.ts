import type { CycleDetail } from "../hooks/useCycles";

export type CycleOutcome = {
  policyBlocked: boolean;
  executionOk: boolean;
  isTreasuryPing: boolean;
  hasTx: boolean;
  hasDecisionLog: boolean;
  cycleFailed: boolean;
};

export type StepVisualState = "complete" | "degraded" | "failed" | "neutral";

export function deriveCycleOutcome(detail: CycleDetail): CycleOutcome {
  const policyBlocked =
    detail.summary.action_type === "policy_blocked" ||
    detail.policy_checks.some((check) => !check.passed);
  const executionOk = detail.execution?.ok === true;
  const isTreasuryPing =
    detail.summary.action_type === "treasury_ping" ||
    String(detail.execution?.calldata?.command ?? "").includes("treasury_ping");
  const hasTx = Boolean(detail.tx_hash?.hash || detail.summary.tx_hash);
  const hasDecisionLog = Boolean(
    detail.decision_log?.rationaleHash || detail.decision_log?.txHash,
  );
  const cycleFailed =
    detail.summary.status === "failed" ||
    (!executionOk && !policyBlocked && !isTreasuryPing);

  return {
    policyBlocked,
    executionOk,
    isTreasuryPing,
    hasTx,
    hasDecisionLog,
    cycleFailed,
  };
}

export function resolvePlannerLabel(
  detail: CycleDetail,
  activeLlmProvider?: string | null,
): string {
  const plan = detail.plan;
  const fromPlan = String(
    (plan as { planner?: string }).planner ??
      plan.planner_version ??
      (plan.plan as { planner?: string } | undefined)?.planner ??
      "",
  );

  if (fromPlan.includes("local_rules")) {
    return "local_rules — deterministic fallback (LLM providers unavailable this cycle)";
  }
  if (fromPlan) {
    return fromPlan.split("@")[0] || fromPlan;
  }
  if (activeLlmProvider === "local_rules") {
    return "local_rules — deterministic fallback (LLM providers unavailable this cycle)";
  }
  if (activeLlmProvider) {
    return activeLlmProvider;
  }
  return "unknown";
}

export function replayNodeEvidenceLabel(
  nodeId: string,
  outcome: CycleOutcome,
  hasPayload: boolean,
): string | null {
  if (!hasPayload && nodeId !== "policy") {
    return null;
  }

  switch (nodeId) {
    case "observation":
      return "OBSERVED";
    case "plan":
      return "PLANNED";
    case "policy":
      return outcome.policyBlocked ? "BLOCKED" : "APPROVED";
    case "execution":
      if (outcome.policyBlocked) {
        return "SKIPPED";
      }
      if (outcome.executionOk && outcome.isTreasuryPing) {
        return "DEGRADED";
      }
      if (outcome.executionOk) {
        return "EXECUTED";
      }
      return "FAILED";
    case "tx":
      if (outcome.hasTx && outcome.executionOk) {
        return "SETTLED";
      }
      if (outcome.policyBlocked && outcome.hasDecisionLog) {
        return "LOGGED";
      }
      if (outcome.hasTx) {
        return "PARTIAL";
      }
      return "NO TX";
    case "onchain":
      return outcome.hasDecisionLog ? "LOGGED" : "NO MATCH";
    case "zerog":
      return null;
    default:
      return null;
  }
}

export function replayNodeIsComplete(
  nodeId: string,
  outcome: CycleOutcome,
  hasPayload: boolean,
): boolean {
  const label = replayNodeEvidenceLabel(nodeId, outcome, hasPayload);
  if (!label) {
    return false;
  }
  return !["FAILED", "NO TX", "NO MATCH", "SKIPPED"].includes(label);
}

export function cognitionStepState(
  stepIndex: number,
  outcome: CycleOutcome,
  hasStepData: boolean,
): StepVisualState {
  if (!hasStepData) {
    return "neutral";
  }

  switch (stepIndex) {
    case 0:
    case 1:
      return "complete";
    case 2:
      return outcome.policyBlocked ? "failed" : "complete";
    case 3:
      if (outcome.policyBlocked) {
        return "neutral";
      }
      if (outcome.executionOk && outcome.isTreasuryPing) {
        return "degraded";
      }
      if (outcome.executionOk) {
        return "complete";
      }
      return "failed";
    case 4:
      if (outcome.hasTx && outcome.executionOk) {
        return "complete";
      }
      if (outcome.policyBlocked && outcome.hasDecisionLog) {
        return "complete";
      }
      if (outcome.hasDecisionLog && !outcome.hasTx) {
        return "degraded";
      }
      return "failed";
    default:
      return "neutral";
  }
}

export function cognitionStepBadge(
  stepIndex: number,
  state: StepVisualState,
): string | null {
  if (state === "failed") {
    if (stepIndex === 2) {
      return "Blocked";
    }
    if (stepIndex === 3) {
      return "Failed";
    }
    if (stepIndex === 4) {
      return "Not settled";
    }
  }
  if (state === "degraded") {
    if (stepIndex === 3) {
      return "Degraded";
    }
    if (stepIndex === 4) {
      return "Logged only";
    }
  }
  if (state !== "complete") {
    return null;
  }

  const labels = ["Observed", "Planned", "Approved", "Executed", "Settled"];
  return labels[stepIndex] ?? null;
}
