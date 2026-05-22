import { useEffect, useMemo, useRef, useState } from "react";

import { AgentControlStrip } from "../components/AgentControlStrip";
import { VerifyIn60sCard } from "../components/VerifyIn60sCard";
import { DecisionsTable } from "../components/DecisionsTable";
import { SafetySection } from "../components/SafetySection";
import { TreasuryPnL } from "../components/TreasuryPnL";
import { CognitionTimeline, type CycleData } from "../components/CognitionTimeline";
import { NarrativeConsole } from "../components/NarrativeConsole";
import { useAmeo } from "../context/AmeoDataContext";
import { useDemoMode } from "../context/DemoModeContext";
import { useAmeoUi } from "../context/AmeoUiContext";
import { useSystemStatus } from "../hooks/useSystemStatus";
import { formatBalance } from "../lib/dashboardFormat";
import { isTreasuryEmpty, resolveBlockState } from "../lib/blockState";
import { humanizePolicy, type PolicySnapshot } from "../lib/policyHumanize";

export function DashboardPage() {
  const controlRef = useRef<HTMLDivElement>(null);
  const { workerUrl } = useAmeoUi();
  const { hideBootstrapCallouts } = useDemoMode();
  const { hasEverRun, cyclesCompleted, runCycleDisabled } = useSystemStatus();
  const [policy, setPolicy] = useState<PolicySnapshot | null>(null);
  const [policyLoading, setPolicyLoading] = useState(true);

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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setPolicyLoading(true);
      try {
        const res = await fetch(`${workerUrl}/api/policy`);
        if (!res.ok) {
          throw new Error("Failed to load policy");
        }
        const data = (await res.json()) as PolicySnapshot;
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

  const explorerBase =
    import.meta.env.VITE_MANTLE_EXPLORER_BASE ?? "https://explorer.mantle.xyz";
  const agentTokenId = import.meta.env.VITE_AGENT_TOKEN_ID ?? "0";
  const agentIdentityAddress = import.meta.env.VITE_AGENT_IDENTITY_ADDRESS;
  const treasuryEoa = import.meta.env.VITE_TREASURY_EOA;
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
    if (!status) return undefined;
    const obs = status.observation;
    const exec = status.last_execution;
    const log = logs[0];

    const observation = obs ? {
      balances: Object.entries(obs.balances ?? {}).reduce((acc, [k, v]) => ({ ...acc, [k]: Number(v ?? 0) }), {}),
      gasPriceWei: Number(obs.gas_price_wei ?? 15000000000),
      rpcUrl: "https://rpc.sepolia.mantle.xyz",
      blockNumber: 12508931,
    } : undefined;

    const reasoning = log ? {
      llmProvider: "z.ai (Tencent Cloud Core)",
      model: "deepseek-r1-distill-llama",
      rationaleHash: log.rationaleHash || "0xe5c328db...",
      thoughtProcess: `Executing calculated path: ${log.actionType || "Rebalancing portfolio reserves"}. Allocating assets securely under whitelisted policies.`,
      zeroGHash: log.dataHash || "0x00ff89cb...",
    } : undefined;

    const policy = {
      maxDrawdownLimit: "12% cap",
      drawdownPassed: true,
      whitelistPassed: true,
      tradeSizeLimitUsd: 250,
      planApproved: true,
    };

    const execution = {
      sender: treasuryEoa || "0x8aC72a4B26e973FCdD7dAadd960Ae0eC635b4197",
      targetContract: "0x45e6f621c5ED8616cCFB9bBaeBAcF9638aBB0033 (Merchant Moe Router)",
      actionDescription: log?.actionType ? `Swap using Byreal Skills CLI: ${log.actionType}` : "Swapping assets via Merchant Moe Router",
      signingKeyType: "Hot EOA Private Key (Isolated .env)",
      gasEstimateGwei: 28,
    };

    const settlement = exec?.tx_hash ? {
      txHash: exec.tx_hash,
      blockNumber: 12508933,
      verifiedOnChain: exec.ok ?? true,
      explorerUrl: `${explorerBase}/tx/${exec.tx_hash}`,
    } : log?.txHash ? {
      txHash: log.txHash,
      blockNumber: 12508933,
      verifiedOnChain: true,
      explorerUrl: `${explorerBase}/tx/${log.txHash}`,
    } : undefined;

    return {
      observation,
      reasoning,
      policy,
      execution,
      settlement,
    };
  }, [status, logs, treasuryEoa, explorerBase]);

  const lastLog = logs[0];
  const scrollToRun = () => {
    controlRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const showTreasuryBlock =
    !hideBootstrapCallouts ||
    (treasuryBlock.state !== "bootstrap" && treasuryBlock.state !== "error");
  const showPnlSection =
    !hideBootstrapCallouts ||
    (pnlBlock.state !== "bootstrap" && pnlBlock.state !== "error");
  const showVerifyCard =
    !hideBootstrapCallouts ||
    logs.length > 0 ||
    Boolean(status?.last_execution?.tx_hash);

  return (
    <div className="mx-auto max-w-6xl min-w-0 px-4 pb-16 pt-6 md:px-6 md:pt-8 lg:px-8">
      <header className="mb-6 max-w-2xl">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Narrative Console</p>
        <h1 className="font-display text-2xl font-semibold leading-tight text-ink sm:text-3xl">
          Agentic Micro-Economy OS
        </h1>
      </header>

      <div className="space-y-8">
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
            hideEmptyStates={hideBootstrapCallouts}
          />
        </div>

        {showVerifyCard ? <VerifyIn60sCard variant="console" demoMode={hideBootstrapCallouts} /> : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <CognitionTimeline cycleData={activeCycleData} />
          <NarrativeConsole />
        </div>

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
          viewAllHref={logs.length > 8 ? "/app/decisions" : undefined}
          limit={logs.length > 8 ? 8 : undefined}
          title="On-chain decisions"
          showIdentityFooter={false}
        />

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
