export type BlockStateKind = "bootstrap" | "loading" | "ready" | "error";

export type BlockState<T> = {
  state: BlockStateKind;
  data?: T;
  error?: string;
};

type ResolveArgs<T> = {
  hasEverRun: boolean;
  loading: boolean;
  data?: T | null;
  error?: string | null;
  /** When true and !hasEverRun, prefer bootstrap over loading. */
  bootstrapWhenEmpty?: boolean;
};

export function resolveBlockState<T>({
  hasEverRun,
  loading,
  data,
  error,
  bootstrapWhenEmpty = false,
}: ResolveArgs<T>): BlockState<T> {
  if (error) {
    return { state: "error", error };
  }
  if (loading) {
    return { state: "loading" };
  }
  if (!hasEverRun && bootstrapWhenEmpty) {
    return { state: "bootstrap" };
  }
  if (!hasEverRun) {
    return { state: "bootstrap" };
  }
  if (data !== undefined && data !== null) {
    return { state: "ready", data };
  }
  return { state: "bootstrap" };
}

/** PnL card is only meaningful after at least one cycle. */
export function shouldRenderPnlCard(cyclesCompleted: number): boolean {
  return cyclesCompleted > 0;
}

export function hasMeaningfulPnlHistory(
  cyclesCompleted: number,
  history: { pnl: number }[],
): boolean {
  if (cyclesCompleted === 0) return false;
  if (history.length === 0) return false;
  return true;
}

export function isTreasuryEmpty(balances: Record<string, number>): boolean {
  const keys = ["USDC", "WMNT", "MNT", "ETH"] as const;
  return keys.every((key) => {
    const value = balances[key];
    return value === undefined || value === 0;
  });
}
