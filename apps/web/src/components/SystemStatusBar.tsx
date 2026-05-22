import { useDemoMode } from "../context/DemoModeContext";
import { useSystemStatus } from "../hooks/useSystemStatus";
import { StatusBanner } from "./StatusBanner";

export function SystemStatusBar() {
  const { demoMode } = useDemoMode();
  const { critical, warning, retryAll } = useSystemStatus();

  if (demoMode) {
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
  const { demoMode } = useDemoMode();
  const { warning } = useSystemStatus();

  if (demoMode || !warning) return null;

  return <StatusBanner level="warning" message={warning.message} />;
}
