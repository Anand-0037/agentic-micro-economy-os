import { DecisionsTable } from "../components/DecisionsTable";
import { useAmeo } from "../context/AmeoDataContext";
import { useSystemStatus } from "../hooks/useSystemStatus";
import { runtimeConfig } from "../lib/runtimeConfig";

export function DecisionsPage() {
  const { logs, logsLoading, logsError, logsLastSuccessAt, refreshLogs } = useAmeo();
  const { hasEverRun } = useSystemStatus();

  const explorerBase = runtimeConfig.explorerBase;
  const agentIdentityAddress = runtimeConfig.agentIdentityAddress;
  const identityExplorerUrl = agentIdentityAddress
    ? `${explorerBase}/address/${agentIdentityAddress}`
    : undefined;

  return (
    <div className="app-page mx-auto max-w-6xl min-w-0 px-4 pb-16 md:px-6 lg:px-8">
      <header className="mb-6 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">On-chain proof</p>
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">Decisions</h1>
        <p className="mt-2 text-sm text-muted">
          Full paginated log of DecisionLogged events from the agent identity contract.
        </p>
      </header>

      <DecisionsTable
        logs={logs}
        loading={logsLoading}
        error={logsError}
        logsLastSuccessAt={logsLastSuccessAt}
        explorerBase={explorerBase}
        identityExplorerUrl={identityExplorerUrl}
        onRefresh={refreshLogs}
        paginated
        pageSize={10}
        emptyStateTarget="decisions"
        hasEverRun={hasEverRun}
        showIdentityFooter
      />
    </div>
  );
}
