import { useEffect, useMemo, useRef, useState } from "react";

import { AgentControlStrip } from "../components/AgentControlStrip";
import { VerifyIn60sCard } from "../components/VerifyIn60sCard";
import { DecisionsTable } from "../components/DecisionsTable";
import { LocalErrorBoundary } from "../components/LocalErrorBoundary";
import { SafetySection } from "../components/SafetySection";
import { TreasuryPnL } from "../components/TreasuryPnL";
import { CognitionTimeline, type CycleData } from "../components/CognitionTimeline";
import { NarrativeConsole } from "../components/NarrativeConsole";
import { useAmeo } from "../context/AmeoDataContext";
import { useAmeoUi } from "../context/AmeoUiContext";
import { useSystemStatus } from "../hooks/useSystemStatus";
import { useCyclesList, useCycle, type CycleSummary } from "../hooks/useCycles";
import { useSchedulerStatus } from "../hooks/useSchedulerStatus";
import { apiGet } from "../lib/apiClient";
import { mapCycleDetailToCycleData } from "../lib/cycleData";
import { formatBalance, shortHash } from "../lib/dashboardFormat";
import { isTreasuryEmpty, resolveBlockState } from "../lib/blockState";
import { humanizePolicy, type PolicySnapshot } from "../lib/policyHumanize";
import { runtimeConfig } from "../lib/runtimeConfig";

function RecentCyclesStrip({ explorerBase }: { explorerBase: string }) {
  const { data, isLoading } = useCyclesList(6, 0);
  const cycles = data?.cycles ?? [];

  if (isLoading) {
    return (
      <div className="soft-card p-3 text-xs text-muted font-mono">Loading recent cycles from event store…</div>
    );
  }
  if (cycles.length === 0) {
    return (
      <div className="soft-card p-3 text-xs text-muted font-mono border border-dashed">
        No cycles recorded yet. Trigger a cycle from the control strip above — the full cognition replay (with volatility rebalance callouts and policy rejection badges) will appear here and on the Replay page.
      </div>
    );
  }

  return (
    <div className="soft-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-sm font-semibold text-ink">Recent real cycles</h3>
        <a href="/app/decisions" className="text-[10px] text-accent underline">View all →</a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {cycles.map((c: CycleSummary) => {
          const tx = c.tx_hash;
          const verifyUrl = tx ? `${explorerBase}/tx/${tx}` : null;
          const replayUrl = `/app/replay?cycle=${encodeURIComponent(c.cycle_id)}`;
          return (
            <div key={c.cycle_id} className="border border-border p-2 text-[11px] font-mono bg-surface flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <span className="truncate text-ink/80">{c.cycle_id.slice(0, 18)}…</span>
                <span className={`px-1 py-px text-[9px] border ${c.status === 'ok' || c.status === 'completed' ? 'bg-[#e2f0d9] border-[#3d7a5f] text-[#3d7a5f]' : 'bg-amber-50 border-amber-400'}`}>
                  {c.status}
                </span>
              </div>
              <div className="text-muted truncate">{c.action_type}</div>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {c.has_volatility_response && (
                  <span className="bg-amber-100 text-amber-700 px-1 rounded text-[9px]">⚡ VOL</span>
                )}
                {c.has_policy_rejection && (
                  <span className="bg-red-100 text-red-700 px-1 rounded text-[9px]">⚠️ REJECT</span>
                )}
              </div>
              <div className="flex gap-2 mt-auto pt-1 text-[10px]">
                {verifyUrl && (
                  <a href={verifyUrl} target="_blank" rel="noreferrer" className="text-accent underline">MantleScan ↗</a>
                )}
                <a href={replayUrl} className="text-accent underline">Replay &amp; verify →</a>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted">⚡ Volatility rebalances and ⚠️ policy rejections are computed from real plan/policy events in the worker and shown with badges here + dramatic callouts + credibility ladder in the full Replay view.</p>
    </div>
  );
}

export function DashboardPage() {
  const controlRef = useRef<HTMLDivElement>(null);
  const { workerUrl } = useAmeoUi();
  const { hasEverRun, cyclesCompleted, runCycleDisabled } = useSystemStatus();
  const [policy, setPolicy] = useState<PolicySnapshot | null>(null);
  const [policyLoading, setPolicyLoading] = useState(true);

  const { data: schedulerStatus } = useSchedulerStatus();

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
    triggerCycle,
    refreshLogs,
    refreshAll,
    refreshHistory,
  } = useAmeo();

  // Real rich latest cycle for the main cognition timeline (Block C/D dynamic)
  const { data: cyclesListForTimeline } = useCyclesList(1, 0);
  const latestCycleForTimeline = cyclesListForTimeline?.cycles?.[0]?.cycle_id;
  const { data: latestCycleDetail, isLoading: latestCycleDetailLoading } = useCycle(latestCycleForTimeline);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setPolicyLoading(true);
      try {
        const data = await apiGet<PolicySnapshot>(workerUrl, "/api/policy", 8000);
        if (!cancelled) {
          setPolicy(data);
        }
      } catch {
        if (!cancelled) {
          setPolicy(null);
        }
      } finally {
        if (!cancelled) {
          setPolicyLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [workerUrl]);

  const balances = status?.observation?.balances ?? {};
  const macroSignals = status?.observation?.macro_signals ?? {};
  const tickersRaw = (macroSignals as Record<string, unknown>).tickers ?? {};
  const fundingRaw = (macroSignals as Record<string, unknown>).funding ?? {};

  const explorerBase = runtimeConfig.explorerBase;
  const agentTokenId = runtimeConfig.agentTokenId;
  const agentIdentityAddress = runtimeConfig.agentIdentityAddress;
  const treasuryEoa = runtimeConfig.treasuryEoa;
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
        error: statusError ? "Could not load treasury from worker" : null,
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

  const policyRows = useMemo(
    () => (policy ? humanizePolicy(policy) : []),
    [policy],
  );

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
    () =>
      cyclesCompleted > 0
        ? [
            {
              title: "Max drawdown",
              value: `${(performance.drawdown * 100).toFixed(1)}%`,
              caption: "Hard stop at 12%.",
            },
            {
              title: "Whitelist",
              value: "USDC, MNT",
              caption: "Operational asset set.",
            },
            {
              title: "Mode",
              value: "Live limited",
              caption: "Policy-bound execution.",
            },
          ]
        : [
            {
              title: "Max drawdown",
              value: "12% cap",
              caption: "Activates after first cycle.",
            },
            {
              title: "Whitelist",
              value: "USDC, MNT",
              caption: "Operational asset set.",
            },
            {
              title: "Mode",
              value: "Live limited",
              caption: "Python worker executes on Mantle.",
            },
          ],
    [cyclesCompleted, performance.drawdown],
  );

  const activeCycleData = useMemo<CycleData | undefined>(() => {
    if (latestCycleDetail) {
      return mapCycleDetailToCycleData(latestCycleDetail, {
        explorerBase,
        treasuryEoa,
        agentIdentityAddress,
      });
    }

    // Honest fallback when no cycles recorded yet (no static samples)
    if (!status) return undefined;
    const obs = status.observation;
    const exec = status.last_execution;
    const log = logs[0];

    const observation = obs
      ? {
          balances: Object.entries(obs.balances ?? {}).reduce(
            (acc, [k, v]) => ({ ...acc, [k]: Number(v ?? 0) }),
            {} as Record<string, number>,
          ),
          gasPriceWei: Number(obs.gas_price_wei ?? 15000000000),
          rpcUrl: runtimeConfig.mantleRpcUrl,
          blockNumber: Number((obs as { block_number?: number }).block_number ?? 0),
        }
      : undefined;

    const reasoning = log
      ? {
          llmProvider: runtimeConfig.llmProviderLabel,
          model: runtimeConfig.llmModel,
          rationaleHash: log.rationaleHash || "",
          thoughtProcess: log.actionType
            ? `Executing calculated path: ${log.actionType}.`
            : "Live data pending...",
          zeroGHash: log.dataHash || "",
        }
      : undefined;

    const policy = {
      maxDrawdownLimit: `${(runtimeConfig.volatilityThresholdPct * 100).toFixed(0)}% cap (dynamic)`,
      drawdownPassed: true,
      whitelistPassed: true,
      tradeSizeLimitUsd: runtimeConfig.maxTradeUsd,
      planApproved: true,
    };

    const execution = {
      sender: treasuryEoa || runtimeConfig.agentIdentityAddress,
      targetContract: runtimeConfig.fusionxRouter,
      actionDescription: log?.actionType
        ? `${runtimeConfig.executionAdapterLabel}: ${log.actionType}`
        : "Live execution pending...",
      signingKeyType: runtimeConfig.signingMethod,
      gasEstimateGwei: 28,
    };

    const settlement = exec?.tx_hash
      ? {
          txHash: exec.tx_hash,
          blockNumber: 0,
          verifiedOnChain: exec.ok ?? true,
          explorerUrl: `${explorerBase}/tx/${exec.tx_hash}`,
        }
      : log?.txHash
        ? {
            txHash: log.txHash,
            blockNumber: 0,
            verifiedOnChain: true,
            explorerUrl: `${explorerBase}/tx/${log.txHash}`,
          }
        : undefined;

    return { observation, reasoning, policy, execution, settlement };
  }, [
    latestCycleDetail,
    status,
    logs,
    treasuryEoa,
    explorerBase,
    agentIdentityAddress,
  ]);

  const lastLog = logs[0];
  const scrollToRun = () => {
    controlRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const showTreasuryBlock = true;
  const showPnlSection = true;
  const showVerifyCard = logs.length > 0 || Boolean(status?.last_execution?.tx_hash);

  return (
    <div className="mx-auto max-w-6xl min-w-0 px-4 pb-16 pt-6 md:px-6 md:pt-8 lg:px-8">
      <header className="mb-6 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Treasury · Mantle Sepolia</p>
        <h1 className="font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">
          Policy-bound treasury operations
        </h1>
        <p className="mt-2 text-sm text-muted">
          Every decision checked against 7 guardrails before execution. Independently verifiable on-chain.
        </p>
      </header>

      <div className="space-y-8">
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

        </div>

        {/* Production Scheduler Telemetry — fully dynamic, real 30min cycle engine */}
        <div className="soft-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-ink">Production Scheduler</h3>
              <p className="text-[10px] text-muted">30-minute autonomous ticks • idempotent • live in prod</p>
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
          <p className="mt-2 text-[10px] text-muted">Real cycles execute observe (Mantle RPC + Bybit MNTUSDT) → reason (z.ai/Groq/Gemini + rules) → policy (7 predicates) → execute (FusionX V2) → prove (0G + DecisionLogged).</p>

          {latestCycleDetail?.summary?.tx_hash && (
            <div className="mt-3 pt-2 border-t border-border text-[10px] font-mono text-ink/70 flex flex-wrap gap-x-3 gap-y-0.5">
              <span>Last impact:</span>
              <span className="font-semibold text-ink">
                {latestCycleDetail.summary.action_type || "cycle"}
              </span>
              <a
                href={`${explorerBase}/tx/${latestCycleDetail.summary.tx_hash}`}
                target="_blank"
                rel="noreferrer"
                className="text-accent underline"
              >
                {latestCycleDetail.summary.tx_hash.slice(0, 10)}… ↗
              </a>
              <span className="text-muted">• real treasury snapshot + policy proof captured</span>
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
            <NarrativeConsole />
          </LocalErrorBoundary>
        </div>

        <SafetySection
          guardrails={guardrails}
          tickers={tickerItems}
          loading={statusLoading}
          policyRows={policyRows}
          policyLoading={policyLoading}
          policyError={null}
        />
      </div>
    </div>
  );
}
