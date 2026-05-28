import { useDemoMode } from "../context/DemoModeContext";
import { runtimeConfig } from "../lib/runtimeConfig";

const githubUrl = runtimeConfig.githubUrl;

export function SiteFooter() {
  const { demoMode } = useDemoMode();
  const identityUrl = runtimeConfig.agentIdentityAddress
    ? `${runtimeConfig.explorerBase}/address/${runtimeConfig.agentIdentityAddress}`
    : undefined;

  return (
    <footer className="border-t border-border bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">
              Verify on-chain
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              <li>
                <a
                  className="text-accent underline-offset-4 hover:underline"
                  href={runtimeConfig.explorerBase}
                  rel="noreferrer"
                  target="_blank"
                >
                  Mantle Explorer
                </a>
              </li>
              {identityUrl ? (
                <li>
                  <a
                    className="text-accent underline-offset-4 hover:underline"
                    href={identityUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Agent identity
                  </a>
                </li>
              ) : null}
              {githubUrl ? (
                <li>
                  <a
                    className="underline-offset-4 hover:underline"
                    href={githubUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Source
                  </a>
                </li>
              ) : null}
            </ul>
          </div>
          {!demoMode ? (
            <p className="max-w-md text-sm text-muted">
              Experimental Mantle testnet Narrative Console. Not financial advice. You are
              responsible for keys, policy limits, and compliance.
            </p>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
