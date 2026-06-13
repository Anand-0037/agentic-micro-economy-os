import { useMemo, useRef } from "react";

import { AgentControlStrip } from "../components/AgentControlStrip";
import { AgentSignerNotice } from "../components/AgentSignerNotice";
import { VerifyIn60sCard } from "../components/VerifyIn60sCard";
import { DecisionsTable } from "../components/DecisionsTable";
import { LocalErrorBoundary } from "../components/LocalErrorBoundary";
import { SafetySection } from "../components/SafetySection";
import { TreasuryPnL } from "../components/TreasuryPnL";
import { CognitionTimeline, type CycleData } from "../components/CognitionTimeline";
import { NarrativeConsole } from "../components/NarrativeConsole";
import { useAmeo } from "../context/AmeoDataContext";
import { useSystemStatus } from "../hooks/useSystemStatus";
import { useCyclesList, useCycle, type CycleSummary } from "../hooks/useCycles";
import { useSchedulerStatus } from "../hooks/useSchedulerStatus";
import { useAmeoConfig } from "../hooks/useAmeoConfig";
import { mapCycleDetailToCycleData } from "../lib/cycleData";
import { formatBalance, shortHash, explorerTxUrl } from "../lib/dashboardFormat";
import { isTreasuryEmpty, resolveBlockState } from "../lib/blockState";
import { humanizePolicy } from "../lib/policyHumanize";
import { runtimeConfig } from "../lib/runtimeConfig";

function RecentCyclesStrip({ explorerBase }: { explorerBase: string }) {
  const { data, isLoading, isError } = useCyclesList(6, 0);
  const cycles = data?.cycles ?? [];

  if (isLoading) {
    return (
      <div className="soft-card p-3 text-xs text-muted font-mono">Loading recent cycles from event store…</div>
    );
  }
  if (isError) {
    return (
      <div className="soft-card p-3 text-xs text-muted font-mono border border-amber-400 bg-amber-50">
        Live worker unavailable. Check VITE_WORKER_URL and retry.
      </div>
    );
  }

  if (cycles.length === 0) {
    return (
      <div className="soft-card p-3 text-xs text-muted font-mono border border-dashed">
        No cycles recorded yet. Trigger a cycle from the control strip above.
      </div>
    );
  }

  return (
    <div className="soft-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-sm font-semibold text-ink">Recent cycles</h3>
        <a href="/app/decisions" className="text-[10px] text-accent underline">View all →</a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {cycles.map((c: CycleSummary) => {
          const txUrl = explorerTxUrl(explorerBase, c.tx_hash);
          const replayUrl = `/app/replay?cycle=${encodeURIComponent(c.cycle_id)}`;
          return (
            <div key={c.cycle_id} className="border border-border p-2 text-[11px] font-mono bg-surface flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <span className="truncate text-ink/80">{c.cycle_id.slice(0, 18)}…</span>
                <span
                  className={`px-1 py-px text-[9px] border ${
                    c.status === "failed" || c.has_policy_rejection
                      ? "bg-red-100 border-red-500 text-red-700"
                      : c.action_type === "treasury_ping"
                        ? "bg-amber-50 border-amber-400 text-amber-800"
                        : c.status === "verified" || c.status === "executed"
                          ? "bg-[#e2f0d9] border-[#3d7a5f] text-[#3d7a5f]"
                          : "bg-amber-50 border-amber-400"
                  }`}
                >
                  {c.action_type === "policy_blocked"
                    ? "blocked"
                    : c.action_type === "treasury_ping"
                      ? "degraded"
                      : c.status}
                </span>
              </div>
              <div className="text-muted truncate">
                {c.action_type === "treasury_ping" ? "degraded path (no DEX liquidity)" : c.action_type}
              </div>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {c.has_volatility_response && (
                  <span className="bg-amber-100 text-amber-700 px-1 rounded text-[9px]">⚡ VOL</span>
                )}
                {c.has_policy_rejection && (
                  <span className="bg-red-100 text-red-700 px-1 rounded text-[9px]">⚠️ REJECT</span>
                )}
              </div>
              <div className="flex gap-2 mt-auto pt-1 text-[10px]">
                {txUrl && (
                  <a href={txUrl} target="_blank" rel="noreferrer" className="text-accent underline">MantleScan ↗</a>
                )}
                <a href={replayUrl} className="text-accent underline">Replay &amp; verify →</a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const controlRef = useRef<HTMLDivElement>(null);
  const { hasEverRun, cyclesCompleted, runCycleDisabled } = useSystemStatus();

  const { data: schedulerStatus } = useSchedulerStatus();
  const { config: ameoConfig, isLoading: configLoading, isUsingFallback: configUsingFallback } = useAmeoConfig();

  const {
    status,
    runner,
    logs,
    history,
    performance,
    statusLoading,
    statusError,
    logsLoading,
    historyLoading,
    historyError,
    actionLoading,
    logsError,
    logsLastSuccessAt,
    healthOk,
    llmChain,
    triggerCycle,
    refreshLogs,
    refreshAll,
    refreshHistory,
  } = useAmeo();

  // Real rich latest cycle for the main cognition timeline (Block C/D dynamic)
  const { data: cyclesListForTimeline } = useCyclesList(1, 0);
  const latestCycleForTimeline = cyclesListForTimeline?.cycles?.[0]?.cycle_id;
  const { data: latestCycleDetail, isLoading: latestCycleDetailLoading } = useCycle(latestCycleForTimeline);

  // Policy rows now sourced from /v1/config (ameoConfig) — single source of truth, no more separate /api/policy poll here.

  const liveBalances = status?.observation?.balances ?? {};
  const balances = liveBalances;
  const macroSignals = status?.observation?.macro_signals ?? {};
  const tickersRaw = (macroSignals as Record<string, unknown>).tickers ?? {};
  const fundingRaw = (macroSignals as Record<string, unknown>).funding ?? {};

  const explorerBase = runtimeConfig.explorerBase;
  const agentTokenId = runtimeConfig.agentTokenId;
  const agentIdentityAddress = runtimeConfig.agentIdentityAddress;
  const treasuryEoa = ameoConfig.signing_eoa || runtimeConfig.treasuryEoa;
  const identityExplorerUrl = agentIdentityAddress
    ? `${explorerBase}/address/${agentIdentityAddress}`
    : undefined;

  const treasuryEmpty = isTreasuryEmpty(balances);

  const treasuryBlock = useMemo(
    () =>
      resolveBlockState({
        hasEverRun: hasEverRun || !treasuryEmpty,
        loading: statusLoading,
        data: balances,
        error: null,
        bootstrapWhenEmpty: treasuryEmpty,
      }),
    [balances, hasEverRun, statusError, statusLoading, treasuryEmpty],
  );

  const pnlBlock = useMemo(
    () =>
      resolveBlockState({
        hasEverRun: cyclesCompleted > 0,
        loading: historyLoading,
        data: history,
        error: historyError,
      }),
    [cyclesCompleted, history, historyError, historyLoading],
  );

  const policyRows = useMemo(() => {
    const snap = ameoConfig
      ? {
          max_drawdown_pct: ameoConfig.max_drawdown_pct,
          max_position_usd: ameoConfig.max_position_usd,
          allowed_assets: ameoConfig.asset_whitelist,
          allowed_protocols: ameoConfig.allowed_protocols,
        }
      : {
          max_drawdown_pct: undefined,
          max_position_usd: undefined,
          allowed_assets: undefined,
          allowed_protocols: [],
        };
    return humanizePolicy(snap);
  }, [ameoConfig]);

  const tickerItems = useMemo(() => {
    const t = tickersRaw as Record<string, { last_price?: number; volume_24h?: number }>;
    const f = fundingRaw as Record<string, { funding_rate?: number }>;
    return (["BTCUSDT", "MNTUSDT"] as const).map((symbol) => ({
      symbol,
      price: formatBalance(t?.[symbol]?.last_price),
      funding: formatBalance(f?.[symbol]?.funding_rate, 6),
      volume: formatBalance(t?.[symbol]?.volume_24h),
    }));
  }, [fundingRaw, tickersRaw]);

  const guardrails = useMemo(
    () => {
      const ddCap = ameoConfig.max_drawdown_pct
        ? `${(ameoConfig.max_drawdown_pct * 100).toFixed(0)}% cap`
        : "12% cap";
      const wl = (ameoConfig.asset_whitelist || ["USDC", "MNT"]).join(", ");
      const pos = ameoConfig.max_position_usd
        ? `$${ameoConfig.max_position_usd} max trade`
        : "$250 max trade";
      const base = [
        {
          title: "Max drawdown",
          value: cyclesCompleted > 0 ? `${(performance.drawdown * 100).toFixed(1)}%` : ddCap,
          caption: cyclesCompleted > 0 ? "Enforced by MaxDrawdownCheck" : `Hard stop at ${ddCap}.`,
        },
        {
          title: "Whitelist",
          value: wl,
          caption: "Operational asset set (AssetWhitelistCheck).",
        },
        {
          title: "Trade size",
          value: pos,
          caption: "Per TradeSizeCheck + daily volume cap.",
        },
      ];
      return base;
    },
    [ameoConfig, cyclesCompleted, performance.drawdown],
  );

  const activeCycleData = useMemo<CycleData | undefined>(() => {
    if (!latestCycleDetail) return undefined;
    return mapCycleDetailToCycleData(latestCycleDetail, {
      explorerBase,
      treasuryEoa,
      agentIdentityAddress,
      ameoConfig,
      activeLlmProvider: llmChain?.active_provider ?? null,
    });
  }, [
    latestCycleDetail,
    treasuryEoa,
    explorerBase,
    agentIdentityAddress,
    ameoConfig,
    llmChain?.active_provider,
  ]);

  const lastLog = logs[0];
  const scrollToRun = () => {
    controlRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const showTreasuryBlock = true;
  const showPnlSection = true;
  const showVerifyCard = logs.length > 0 || Boolean(status?.last_execution?.tx_hash);

  return (
    <div className="app-page mx-auto max-w-6xl min-w-0 px-4 pb-16 md:px-6 lg:px-8">
      <header className="mb-6 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Treasury · Mantle Sepolia</p>
        <h1 className="font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">
          Policy-bound treasury operations
        </h1>
        <p className="mt-2 text-sm text-muted">
          Every decision checked against {ameoConfig.guardrails.length} guardrails before execution. Independently verifiable on-chain.
        </p>
      </header>

      <div className="space-y-8">
        <AgentSignerNotice />

        {showTreasuryBlock ? (
          <TreasuryPnL
            balances={balances}
            gasPriceWei={status?.observation?.gas_price_wei ?? undefined}
            treasuryEoa={treasuryEoa}
            pnlHistory={history}
            performance={performance}
            cyclesCompleted={cyclesCompleted}
            treasuryBlock={treasuryBlock}
            pnlBlock={pnlBlock}
            onRetryTreasury={() => {
              void refreshAll(false);
            }}
            onRetryPnl={() => {
              void refreshHistory();
            }}
            hidePnlSection={!showPnlSection}
          />
        ) : null}

        <div ref={controlRef}>
          <AgentControlStrip
            workerHealthy={healthOk}
            workerLoading={statusLoading && !status}
            runner={runner}
            status={status}
            actionLoading={actionLoading}
            runCycleDisabled={runCycleDisabled}
            agentTokenId={agentTokenId}
            treasuryEoa={treasuryEoa}
            lastLog={lastLog}
            explorerBase={explorerBase}
            onRunCycle={triggerCycle}
          />

          {llmChain?.active_provider === "local_rules" && (
            <div className="mt-3 rounded border border-amber-400 bg-amber-50 px-3 py-2 text-xs text-amber-900 font-mono">
              LLM providers unavailable — cycles use <strong>local_rules</strong> fallback.
              Fix <code>Z_AI_API_KEY</code> / model on Render before recording the demo.
              Chain: {(llmChain.available_providers ?? []).join(" → ")}
            </div>
          )}
        </div>

        {/* Production Scheduler Telemetry — interval from worker /v1/scheduler/status */}
        <div className="soft-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-ink">Production Scheduler</h3>
              <p className="text-[10px] text-muted">
                {schedulerStatus?.interval_minutes != null
                  ? `${schedulerStatus.interval_minutes}-minute autonomous ticks`
                  : "Autonomous ticks"}{" "}
                · idempotent · live in prod
              </p>
            </div>
            <span className={`px-2 py-0.5 text-[10px] font-mono border ${schedulerStatus?.enabled ? 'bg-[#e2f0d9] border-[#3d7a5f] text-[#3d7a5f]' : 'bg-amber-50 border-amber-400 text-amber-700'}`}>
              {schedulerStatus?.enabled ? 'ACTIVE' : 'OFF'}
            </span>
          </div>
          {schedulerStatus ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono text-ink/80">
              <div>Interval: <span className="font-semibold text-ink">{schedulerStatus.interval_minutes}min</span></div>
              <div>Next tick: <span className="font-semibold text-ink">{schedulerStatus.next_scheduled_tick ? new Date(schedulerStatus.next_scheduled_tick).toLocaleTimeString() : '—'}</span></div>
              <div>Last cycle: <span className="font-semibold text-ink">{schedulerStatus.last_cycle_id || '—'}</span></div>
              <div>Uptime: <span className="font-semibold text-ink">{Math.floor((schedulerStatus.uptime_seconds || 0) / 3600)}h {(Math.floor((schedulerStatus.uptime_seconds || 0) % 3600) / 60).toFixed(0)}m</span></div>
            </div>
          ) : (
            <div className="text-xs text-muted font-mono">Loading scheduler status from worker...</div>
          )}
          <p className="mt-2 text-[10px] text-muted">Real cycles: observe → reason (z.ai/Groq/Gemini) → policy ({ameoConfig.guardrails.length} predicates) → execute (FusionX V2 or treasury_ping) → prove (DecisionLogged on Mantle).</p>

          {latestCycleDetail?.summary?.tx_hash && (
            <div className="mt-3 pt-2 border-t border-border text-[10px] font-mono text-ink/70 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>Last impact:</span>
              <span className="font-semibold text-ink">
                {latestCycleDetail.summary.action_type || "cycle"}
                {latestCycleDetail.summary.action_type === "treasury_ping" && (
                  <span className="ml-1 text-amber-600">(testnet fallback - no DEX liquidity)</span>
                )}
                {llmChain?.active_provider === "local_rules" && (
                  <span className="ml-1 text-amber-600">(LLM unavailable — rules fallback)</span>
                )}
              </span>
              {explorerTxUrl(explorerBase, latestCycleDetail.tx_hash?.hash ?? latestCycleDetail.summary.tx_hash) ? (
                <a
                  href={explorerTxUrl(explorerBase, latestCycleDetail.tx_hash?.hash ?? latestCycleDetail.summary.tx_hash)!}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent underline"
                >
                  {shortHash(latestCycleDetail.tx_hash?.hash ?? latestCycleDetail.summary.tx_hash)} ↗
                </a>
              ) : null}
              <span className="text-muted">• decision proof from /api/cycles (same hash as verify card)</span>
            </div>
          )}
        </div>

        {/* Dynamic recent cycles strip — 100% from /api/cycles (rich event-backed). Volatility & policy rejections surface fully in /app/replay for each cycle. */}
        <RecentCyclesStrip explorerBase={explorerBase} />

        {showVerifyCard ? <VerifyIn60sCard variant="console" /> : null}

        <DecisionsTable
          logs={logs}
          loading={logsLoading}
          error={logsError}
          logsLastSuccessAt={logsLastSuccessAt}
          explorerBase={explorerBase}
          identityExplorerUrl={identityExplorerUrl}
          onRefresh={refreshLogs}
          onScrollToRun={scrollToRun}
          hasEverRun={hasEverRun}
          viewAllHref={logs.length > 12 ? "/app/decisions" : undefined}
          limit={12}
          title="Activity feed"
          showIdentityFooter={false}
        />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div>
            {latestCycleDetailLoading && (
              <div className="text-[10px] text-muted font-mono mb-1">Loading latest cycle detail for timeline…</div>
            )}
            <LocalErrorBoundary title="Cognition timeline failed to render.">
              <CognitionTimeline cycleData={activeCycleData} />
            </LocalErrorBoundary>
          </div>
          <LocalErrorBoundary title="Worker telemetry failed to render.">
            <NarrativeConsole summaryMode />
          </LocalErrorBoundary>
        </div>

        <SafetySection
          guardrails={guardrails}
          guardrailsCount={ameoConfig.guardrails.length}
          tickers={tickerItems}
          loading={statusLoading}
          policyRows={policyRows}
          policyLoading={configLoading}
          policyError={null}
          slippageBps={ameoConfig?.dex_slippage_bps}
          maxDrawdownPct={ameoConfig.max_drawdown_pct}
        />
      </div>
    </div>
  );
}
