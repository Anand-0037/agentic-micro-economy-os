import { Sentry } from "../sentry";

declare function myUndefinedFunction(): void;

export function SentryExamplePage() {
  const configured = Boolean(import.meta.env.VITE_SENTRY_DSN);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">Sentry example</p>
      <h1 className="font-display text-3xl font-semibold">Verify your setup</h1>
      <p className="text-sm text-muted">
        Click the button below to throw an uncaught error. If Sentry is configured, it should appear in your{" "}
        <a
          className="text-accent underline-offset-2 hover:underline"
          href="https://abes-engineering-college-cd.sentry.io/issues/?project=turing-test"
          rel="noreferrer"
          target="_blank"
        >
          Issues dashboard
        </a>{" "}
        within ~30 seconds.
      </p>
      <p className="text-xs text-muted">
        DSN: {configured ? "configured" : "missing — set VITE_SENTRY_DSN in .env"}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          className="neo-button bg-accent px-5 py-2.5 text-sm font-semibold text-surface"
          type="button"
          onClick={() => {
            myUndefinedFunction();
          }}
        >
          Throw sample error
        </button>
        <button
          className="neo-button bg-surface px-5 py-2.5 text-sm font-semibold"
          type="button"
          onClick={() => {
            Sentry.captureException(new Error("AMEO Sentry captured exception test"));
          }}
        >
          Capture exception
        </button>
      </div>
    </div>
  );
}
