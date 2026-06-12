import type { PolicyDisplayRow } from "../lib/policyHumanize";
import { ActivePolicyCard } from "./ActivePolicyCard";
import { runtimeConfig } from "../lib/runtimeConfig";

type TickerItem = {
  symbol: string;
  price: string | null;
  funding: string | null;
  volume: string | null;
};

type SafetySectionProps = {
  guardrails: { title: string; value: string; caption: string }[];
  tickers: TickerItem[];
  loading?: boolean;
  policyRows?: PolicyDisplayRow[];
  policyLoading?: boolean;
  policyError?: string | null;
  slippageBps?: number;
};

export function SafetySection({
  guardrails,
  tickers,
  loading,
  policyRows = [],
  policyLoading,
  policyError,
  slippageBps,
}: SafetySectionProps) {
  const slippagePct = ((slippageBps ?? 100) / 100).toFixed(1);
  return (
    <details className="soft-card group">
      <summary className="cursor-pointer list-none px-4 py-4 text-sm font-semibold text-ink marker:content-none sm:px-5">
        <span className="flex items-center justify-between gap-2">
          <span>Policy guardrails &amp; market context</span>
          <span className="text-muted group-open:rotate-180 transition-transform" aria-hidden>
            ▸
          </span>
        </span>
        <p className="mt-1 text-xs font-normal text-muted">
          {guardrails.length} active guardrails enforced before every execution · Live market signals
        </p>
      </summary>

      <div className="border-t border-border px-4 pb-5 pt-2 sm:px-5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          Policy Guardrails (Enforced Outside LLM) — 7 total (3 shown; 4 active)
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {guardrails.map((rail) => (
            <div key={rail.title} className="rounded-lg bg-neutral-100/80 p-3 dark:bg-neutral-800/40">
              <p className="text-xs font-semibold text-muted">{rail.title}</p>
              <p className="mt-2 text-sm font-semibold tabular-nums text-ink">{rail.value}</p>
              <p className="mt-1 text-[0.65rem] text-muted">{rail.caption}</p>
            </div>
          ))}
        </div>

        <details className="mt-2">
          <summary className="text-xs text-muted cursor-pointer font-medium hover:text-ink">
            + Show all 7 guardrails (active; not surfaced in the cycle card)
          </summary>
          <ul className="mt-1 text-[10px] text-muted pl-4 list-disc space-y-0.5">
            <li>✓ MaxDrawdownCheck (drawdown cap: {guardrails[0]?.value || "12% cap"})</li>
            <li>✓ AssetWhitelistCheck (allowed: {guardrails[1]?.value || "USDC, MNT"})</li>
            <li>✓ TradeSizeCheck (limit: {guardrails[2]?.value || "$250 max trade"})</li>
            <li>✓ GasBudgetCheck (gas budget cap: 0.05 MNT/cycle)</li>
            <li>✓ MinimumBalanceCheck (min balance: 5.0 MNT)</li>
            <li>✓ SlippageToleranceCheck (slippage tolerance: {slippagePct}% cap)</li>
            <li>✓ ExecutionFrequencyCheck (execution frequency: 12/hour max)</li>
          </ul>
        </details>


        <ActivePolicyCard rows={policyRows} loading={policyLoading} error={policyError} />

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted">
          Market signals
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {tickers.map((item) => (
            <div
              key={item.symbol}
              className="rounded-lg border border-border/80 bg-surface p-3"
            >
              <p className="text-xs font-semibold text-muted">{item.symbol}</p>
              <p className="mt-2 text-lg font-semibold tabular-nums text-ink">
                {loading ? "…" : item.price ? `$${item.price}` : "Price unavailable"}
              </p>
              <p className="mt-1 text-xs tabular-nums text-muted">
                Funding {item.funding ?? "—"} · 24h vol {item.volume ?? "—"}
              </p>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
