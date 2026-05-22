import { Sentry } from "../sentry";

type Props = {
  error: unknown;
  resetError: () => void;
};

export function SentryErrorFallback({ error, resetError }: Props) {
  const message = error instanceof Error ? error.message : "Something went wrong";

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-2xl font-semibold">Unexpected error</h1>
      <p className="max-w-md text-sm text-muted">{message}</p>
      <button
        type="button"
        className="neo-button bg-accent px-4 py-2 text-sm font-semibold text-surface"
        onClick={resetError}
      >
        Try again
      </button>
    </div>
  );
}

export function captureSentryTestError() {
  Sentry.captureException(new Error("AMEO Sentry client test — delete me"));
}
