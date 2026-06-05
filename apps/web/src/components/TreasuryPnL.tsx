import { useState, useRef, useEffect } from "react";

import type { HistoryPoint } from "../hooks/useAmeo";
import type { BlockState } from "../lib/blockState";
import { hasMeaningfulPnlHistory, shouldRenderPnlCard } from "../lib/blockState";
import { formatBalance, shortAddress } from "../lib/dashboardFormat";
import { Skeleton } from "./ui/Skeleton";

type TreasuryPnLProps = {
  balances: Record<string, number>;
  gasPriceWei?: number | null;
  treasuryEoa?: string;
  pnlHistory: HistoryPoint[];
  performance: { sharpe: number; drawdown: number };
  cyclesCompleted: number;
  treasuryBlock: BlockState<Record<string, number>>;
  pnlBlock: BlockState<HistoryPoint[]>;
  onRetryTreasury?: () => void;
  onRetryPnl?: () => void;
  hidePnlSection?: boolean;
};

function displayAssets(balances: Record<string, number>) {
  return [
    { symbol: "USDC", amount: balances.USDC ?? 0 },
    { symbol: "WMNT", amount: balances.WMNT ?? 0 },
    { symbol: "MNT", amount: balances.MNT ?? 0 },
  ];
}

function allocationRows(balances: Record<string, number>) {
  const USDC = balances.USDC ?? 0;
  const WMNT = balances.WMNT ?? 0;
  const MNT = balances.MNT ?? 0;
  const total = USDC + WMNT + MNT;
  if (total <= 0) {
    return [
      { symbol: "MNT", amount: 0, pct: 100 },
      { symbol: "WMNT", amount: 0, pct: 0 },
      { symbol: "USDC", amount: 0, pct: 0 },
    ];
  }
  return [
    { symbol: "MNT", amount: MNT, pct: (MNT / total) * 100 },
    { symbol: "WMNT", amount: WMNT, pct: (WMNT / total) * 100 },
    { symbol: "USDC", amount: USDC, pct: (USDC / total) * 100 },
  ];
}

function TreasuryEmptyCard({
  treasuryEoa,
  onCopy,
  copied,
}: {
  treasuryEoa?: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-border bg-neutral-50 p-4 text-sm">
      <p className="font-medium text-ink">Treasury (Testnet)</p>
      <p className="text-amber-600 text-sm mt-2">
        ⚠️ Testnet treasury empty - add MNT from Mantle faucet to see live cycles.
        <br />
        <span className="text-xs text-muted">Production agents would manage deposited funds.</span>
      </p>
      <p className="mt-2 text-muted">
        Treasury address:{" "}
        <span className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={onCopy}
            className="font-mono text-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink rounded px-0.5"
            title="Click to copy full address"
          >
            {treasuryEoa ? shortAddress(treasuryEoa) : "treasury wallet"}
          </button>
          {copied ? <span className="text-[10px] text-ok">copied</span> : null}
        </span>
      </p>

    </div>
  );
}

export function TreasuryPnL({
  balances,
  gasPriceWei,
  treasuryEoa,
  pnlHistory,
  performance,
  cyclesCompleted,
  treasuryBlock,
  pnlBlock,
  onRetryTreasury,
  onRetryPnl,
  hidePnlSection = false,
}: TreasuryPnLProps) {
  const fundedAssets = displayAssets(balances);
  const allocations = allocationRows(balances);
  const heroTotal = allocations.reduce((sum, row) => sum + row.amount, 0);
  const showPnl = shouldRenderPnlCard(cyclesCompleted);
  const meaningfulPnl = hasMeaningfulPnlHistory(cyclesCompleted, pnlHistory);
  const latestPnl = meaningfulPnl ? pnlHistory[pnlHistory.length - 1]?.pnl : null;

  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number>();
  const copyAddress = async () => {
    if (!treasuryEoa) return;
    try {
      await navigator.clipboard.writeText(treasuryEoa);
      setCopied(true);
      
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  // Best practice: Also clear on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <section
      className={`grid gap-4 ${showPnl && meaningfulPnl ? "lg:grid-cols-[1fr,auto]" : ""}`}
      aria-labelledby="treasury-heading"
    >
      <div className="soft-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Treasury EOA</p>
            <h2 id="treasury-heading" className="mt-1 font-display text-lg font-semibold text-ink">
              {treasuryEoa ? (
                <span className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void copyAddress()}
                    className="font-mono text-lg hover:underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink rounded px-1 -mx-1"
                    title="Click to copy full address"
                  >
                    {shortAddress(treasuryEoa)}
                  </button>
                  {copied ? <span className="text-[10px] text-ok">copied</span> : null}
                </span>
              ) : (
                "Treasury"
              )}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">On-chain balance</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-ink">
              {formatBalance(balances.USDC ?? 0, 2)} USDC
            </p>
            <p className="mt-1 text-xs text-muted">
              {formatBalance(balances.WMNT ?? 0, 4)} WMNT &middot; {formatBalance(balances.MNT ?? 0, 4)} MNT
            </p>
          </div>
        </div>

        {treasuryBlock.state === "loading" ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : treasuryBlock.state === "error" ? (
          <div className="mt-4 text-sm">
            <p className="font-semibold text-danger">Couldn&apos;t load treasury.</p>
            {onRetryTreasury ? (
              <button
                type="button"
                className="btn-secondary mt-3 h-9 px-3 text-xs font-semibold"
                onClick={onRetryTreasury}
              >
                Retry
              </button>
            ) : null}
          </div>
        ) : treasuryBlock.state === "bootstrap" ? (
          <TreasuryEmptyCard
            treasuryEoa={treasuryEoa}
            onCopy={() => {
              void copyAddress();
            }}
            copied={copied}
          />
        ) : (
          <>
            {allocations.length > 0 ? (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Allocation</p>
                <div className="mt-2 flex h-3 overflow-hidden rounded-full border border-border bg-neutral-100">
                  {allocations.map((row, index) => (
                    <div
                      key={row.symbol}
                      className={index === 0 ? "bg-accent" : "bg-ok"}
                      style={{ width: `${row.pct}%` }}
                      title={`${row.symbol} ${row.pct.toFixed(1)}%`}
                    />
                  ))}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {allocations.map((row) => (
                    <li key={row.symbol}>
                      {row.symbol} {row.pct.toFixed(0)}% &bull; {row.symbol} {row.symbol === "USDC" ? formatBalance(row.amount, 2) : formatBalance(row.amount, 4)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <ul className="mt-4 space-y-2 text-sm">
            {fundedAssets.map(({ symbol, amount }) => (
              <li
                key={symbol}
                className="flex items-center justify-between border-b border-border/60 py-2"
              >
                <span className="font-medium">{symbol}</span>
                <span className="tabular-nums font-semibold text-ink">
                  {formatBalance(amount)}
                </span>
              </li>
            ))}
            {typeof gasPriceWei === "number" ? (
              <li className="flex items-center justify-between py-2 text-muted">
                <span>Gas (est.)</span>
                <span className="tabular-nums">{formatBalance(gasPriceWei / 1e18, 4)} MNT</span>
              </li>
            ) : null}
          </ul>
          </>
        )}
      </div>

      {showPnl && meaningfulPnl && !hidePnlSection ? (
        <div className="soft-card flex min-w-[10rem] flex-col justify-center p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Session PnL</p>
          {pnlBlock.state === "loading" ? (
            <Skeleton className="mt-3 h-8 w-24" />
          ) : pnlBlock.state === "error" ? (
            <p className="mt-3 text-sm text-danger">Unavailable</p>
          ) : (
            <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
              {latestPnl !== null && latestPnl !== undefined
                ? `${latestPnl >= 0 ? "+" : ""}${latestPnl.toFixed(4)}`
                : "0.0000"}
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            Sharpe {performance.sharpe.toFixed(2)} · DD {(performance.drawdown * 100).toFixed(1)}%
          </p>
        </div>
      ) : null}
    </section>
  );
}
