type StatusBannerProps = {
  level: "critical" | "warning" | "info";
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function StatusBanner({
  level,
  message,
  actionLabel,
  onAction,
}: StatusBannerProps) {
  if (level === "info") return null;

  if (level === "warning") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-[0.65rem] font-semibold text-ink"
        title={message}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-warn" aria-hidden />
        {message}
      </span>
    );
  }

  return (
    <div
      className="border-b border-danger/40 bg-danger/10 px-4 py-3 md:px-6 lg:px-8"
      role="alert"
      aria-live="assertive"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-danger">{message}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            className="btn-secondary h-9 shrink-0 px-4 text-xs font-semibold"
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
