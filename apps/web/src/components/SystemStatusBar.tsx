import { useSystemStatus } from "../hooks/useSystemStatus";
import { StatusBanner } from "./StatusBanner";

export function SystemStatusBar() {
  const { critical, retryAll } = useSystemStatus();

  if (critical) {
    return (
      <StatusBanner
        level="critical"
        message={critical.message}
        actionLabel={critical.actionLabel}
        onAction={() => {
          void retryAll();
        }}
      />
    );
  }

  return null;
}

export function SystemStatusWarningPill() {
  const { warning } = useSystemStatus();

  if (!warning) return null;

  return <StatusBanner level="warning" message={warning.message} />;
}
