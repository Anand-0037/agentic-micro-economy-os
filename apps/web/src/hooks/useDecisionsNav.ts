import { useAmeo } from "../context/AmeoDataContext";

export function useDecisionsNav() {
  const { logs, logsLoading, logsError } = useAmeo();
  const identityConfigured = Boolean(import.meta.env.VITE_AGENT_IDENTITY_ADDRESS);

  const showDecisionsTab =
    identityConfigured &&
    !(logsError && logs.length === 0 && !logsLoading);

  return { showDecisionsTab };
}
