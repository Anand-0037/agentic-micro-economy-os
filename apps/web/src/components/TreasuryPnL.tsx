import { useState } from "react";

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
  const rows: { symbol: string; amount: number | undefined }[] = [
    { symbol: "USDC", amount: balances.USDC },
    { symbol: "WMNT", amount: balances.WMNT ?? balances.MNT },
  ];
  return rows.filter((row) => typeof row.amount === "number" && row.amount > 0);
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
      <p className="font-medium text-ink">Treasury empty</p>
      <p className="mt-2 text-muted">
        Fund{" "}
        <span className="font-mono text-ink">
          {treasuryEoa ? shortAddress(treasuryEoa) : "treasury wallet"}
        </span>{" "}
        with testnet USDC to begin.
      </p>
      {treasuryEoa ? (
        <button
          type="button"
          className="btn-secondary mt-3 h-9 px-3 text-xs font-semibold"
          onClick={onCopy}
        >
          {copied ? "Copied" : "Copy wallet address"}
        </button>
      ) : null}
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
  const showPnl = shouldRenderPnlCard(cyclesCompleted);
  const meaningfulPnl = hasMeaningfulPnlHistory(cyclesCompleted, pnlHistory);
  const latestPnl = meaningfulPnl ? pnlHistory[pnlHistory.length - 1]?.pnl : null;

  const [copied, setCopied] = useState(false);
  const copyAddress = async () => {
    if (!treasuryEoa) return;
    try {
      await navigator.clipboard.writeText(treasuryEoa);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section
      className={`grid gap-4 ${showPnl && meaningfulPnl ? "lg:grid-cols-[1fr,auto]" : ""}`}
      aria-labelledby="treasury-heading"
    >
      <div className="soft-card p-4 sm:p-5">
        <h2 id="treasury-heading" className="font-display text-lg font-semibold text-ink">
          Treasury
        </h2>

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
