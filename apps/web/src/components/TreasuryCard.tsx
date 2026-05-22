type TreasuryCardProps = {
  balances: Record<string, number>;
  gasPriceWei?: number | null;
  agentTokenId: string;
  treasuryEoa?: string;
  pnlHistory?: { created_at: string; pnl: number }[];
  error?: string | null;
};

export function TreasuryCard({
  balances,
  gasPriceWei,
  agentTokenId,
  treasuryEoa,
  pnlHistory,
  error,
}: TreasuryCardProps) {
  const formatValue = (value?: number | null) =>
    typeof value === "number"
      ? value.toLocaleString(undefined, { maximumFractionDigits: 4 })
      : "-";

  const totalBalance = Object.values(balances).reduce(
    (sum, value) => sum + Number(value ?? 0),
    0,
  );

  const tokenCards = ["USDC", "ETH", "MNT"].map((symbol) => ({
    label: symbol,
    value: balances[symbol],
  }));

  const chartValues = pnlHistory?.map((point) => point.pnl) ?? [];
  const maxValue = chartValues.length ? Math.max(...chartValues) : 1;
  const minValue = chartValues.length ? Math.min(...chartValues) : 0;
  const range = Math.max(maxValue - minValue, 1);
  const points = chartValues
    .map((value, index) => {
      const x = (index / Math.max(chartValues.length - 1, 1)) * 180 + 10;
      const y = 60 - ((value - minValue) / range) * 44 + 10;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="neo-card min-w-0 p-4 sm:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
        <div className="min-w-0 flex-1 space-y-4 sm:space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                Live Treasury Balances
              </p>
              <div className="mt-3 flex flex-wrap items-baseline gap-2 sm:gap-3">
                <span className="font-display text-3xl font-semibold tabular-nums sm:text-4xl md:text-5xl">
                  {formatValue(totalBalance)}
                </span>
                <span className="shrink-0 rounded-full border-2 border-ink bg-sand px-2 py-1 text-xs font-semibold">
                  Gas {formatValue(gasPriceWei ?? undefined)}
                </span>
              </div>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted">
                Total (raw units)
              </p>
            </div>
            <div className="shrink-0 sm:text-right">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Agent ID</p>
              <p className="mt-2 font-mono text-sm">NFT #{agentTokenId}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            {tokenCards.map((item) => (
              <div key={item.label} className="neo-card-sm min-w-0 p-3 sm:p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted">{item.label}</p>
                <p className="mt-2 truncate text-lg font-semibold tabular-nums">
                  {formatValue(item.value)}
                </p>
              </div>
            ))}
          </div>

          <div className="min-w-0 border-2 border-ink bg-sand p-3 text-xs sm:p-4">
            <p className="font-semibold uppercase tracking-[0.16em]">Treasury EOA</p>
            <p className="mt-2 break-all font-mono text-[0.7rem] leading-relaxed sm:text-xs">
              {treasuryEoa || "Not configured"}
            </p>
          </div>
        </div>

        <div className="neo-card-sm flex min-w-0 w-full flex-col justify-between p-4 lg:w-[220px] lg:shrink-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              PnL Timeline
            </p>
            <p className="mt-2 text-sm text-muted">Last 24 samples</p>
          </div>
          <div className="mt-4 min-w-0 rounded-none border-2 border-ink bg-bg p-2 sm:p-3">
            {points ? (
              <svg
                viewBox="0 0 200 80"
                className="h-16 w-full min-w-0 sm:h-20"
                aria-hidden="true"
                preserveAspectRatio="none"
              >
                <polyline
                  points={points}
                  fill="none"
                  stroke="rgb(var(--accent-rgb) / 1)"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            ) : (
              <p className="py-6 text-center text-xs text-muted">Awaiting PnL history.</p>
            )}
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-6 border-2 border-ink bg-sand p-4 text-sm">
          <p className="font-semibold">Status issue detected.</p>
          <p className="mt-1 text-xs text-muted">{error}</p>
        </div>
      ) : null}
    </div>
  );
}
