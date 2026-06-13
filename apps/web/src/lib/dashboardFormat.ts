export function formatBalance(value?: number | null, decimals = 4): string | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  });
}

export function shortAddress(addr?: string, head = 6, tail = 4): string {
  if (!addr) return "—";
  if (addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

export function shortHash(hash?: string, head = 6, tail = 4): string {
  if (!hash) return "—";
  const clean = normalizeTxHash(hash) ?? hash;
  if (clean.length <= head + tail + 2) return clean;
  return `${clean.slice(0, head + 2)}…${clean.slice(-tail)}`;
}

/** Canonical 0x-prefixed tx hash for explorer links and API comparison. */
export function normalizeTxHash(hash?: string | null): string | null {
  if (!hash) return null;
  const trimmed = String(hash).trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (lower.startsWith("0x")) return lower;
  if (/^[0-9a-f]{64}$/i.test(trimmed)) return `0x${lower}`;
  return lower;
}

export function explorerTxUrl(explorerBase: string, hash?: string | null): string | null {
  const normalized = normalizeTxHash(hash);
  if (!normalized) return null;
  const base = explorerBase.replace(/\/$/, "");
  return `${base}/tx/${normalized}`;
}

export function timeAgo(iso?: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return new Date(iso).toLocaleString();
}

export function cycleIdFromMetadataUri(uri?: string | null): string | null {
  if (!uri?.startsWith("ameo://cycle/")) return null;
  return uri.slice("ameo://cycle/".length).trim() || null;
}

/** On-chain DecisionLogged may say "swap" while the worker cycle was treasury_ping — prefer cycle truth. */
export function formatDecisionActionLabel(
  onChainActionType: string,
  cycleActionType?: string | null,
): string {
  const cycle = cycleActionType?.trim().toLowerCase();
  if (cycle === "treasury_ping") return "treasury_ping (degraded)";
  if (cycle === "policy_blocked") return "policy_blocked";
  if (cycle && cycle !== onChainActionType.toLowerCase()) {
    return cycle.replace(/_/g, " ");
  }
  const onChain = onChainActionType.trim();
  if (onChain.toLowerCase() === "treasury_ping") return "treasury_ping (degraded)";
  if (onChain.toLowerCase() === "policy_blocked") return "policy_blocked";
  return onChain;
}

export function formatBlockNumber(block?: number | null): string {
  if (block == null || block <= 0) return "— (pending)";
  return `#${block}`;
}

export function formatSchedulerInterval(minutes?: number | null): string {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
}

export function decisionStatus(actionType: string): "ok" | "warn" | "error" {
  const upper = actionType.toUpperCase();
  if (
    upper.includes("POLICY_BLOCKED") ||
    upper.includes("FAIL") ||
    upper.includes("ERROR") ||
    upper.includes("REJ")
  ) {
    return "error";
  }
  if (
    upper.includes("TREASURY_PING") ||
    upper.includes("DEGRADED") ||
    upper.includes("NO_OP") ||
    upper.includes("HOLD") ||
    upper.includes("SKIP")
  ) {
    return "warn";
  }
  return "ok";
}
