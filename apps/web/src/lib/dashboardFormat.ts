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
  const clean = hash.startsWith("0x") ? hash : `0x${hash}`;
  if (clean.length <= head + tail + 2) return clean;
  return `${clean.slice(0, head + 2)}…${clean.slice(-tail)}`;
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

export function decisionStatus(actionType: string): "ok" | "warn" | "error" {
  const upper = actionType.toUpperCase();
  if (upper.includes("FAIL") || upper.includes("ERROR")) return "error";
  if (upper.includes("NO_OP") || upper.includes("HOLD") || upper.includes("SKIP")) {
    return "warn";
  }
  return "ok";
}
