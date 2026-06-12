import { runtimeConfig } from "../lib/runtimeConfig";

const explorerBase = runtimeConfig.explorerBase;
const treasuryEoa = runtimeConfig.treasuryEoa;
const agentIdentityAddress = runtimeConfig.agentIdentityAddress;
const agentTokenId = runtimeConfig.agentTokenId;
const zeroGIndexerBase = runtimeConfig.zeroGIndexerUrl;

const FUSIONX_ROUTER = runtimeConfig.fusionxRouter;

const chips = [
  {
    icon: "🛡️",
    title: "Policy enforcement",
    sub: "Guardrails enforced before every execution",
    href: `${runtimeConfig.workerUrl.replace(/\/$/, "")}/v1/policies`,
  },
  {
    icon: "✓",
    title: "Verifiable decisions",
    sub: "Every rationale + policy check on-chain",
    href: agentIdentityAddress
      ? `${explorerBase}/address/${agentIdentityAddress}#code`
      : explorerBase,
  },
  {
    icon: "🪙",
    title: "Mantle settlement",
    sub: "MNT-paid gas · FusionX V2 (treasury_ping when Sepolia liquidity is thin)",
    href: `${explorerBase}/address/${FUSIONX_ROUTER}`,
  },
  {
    icon: "🧠",
    title: "0G Storage proofs",
    sub: "Permanent rationale anchoring + indexer",
    href: zeroGIndexerBase,
  },
] as const;

export function MantleProofRail() {
  return (
    <section className="border-t border-border bg-surface py-10 md:py-12" aria-label="Mantle proof rail">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {chips.map((chip) => (
            <a
              key={chip.title}
              className="neo-card-sm flex min-h-[5.5rem] items-center gap-3 p-4 transition-transform hover:-translate-y-0.5"
              href={chip.href}
              rel="noreferrer"
              target="_blank"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-ink bg-sand text-xl">
                {chip.icon}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-sm font-semibold text-ink">{chip.title}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted">{chip.sub}</span>
              </span>
            </a>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-muted italic">
          Policy-bound autonomous agents for DAO treasuries, foundations, and microfinance.
        </p>
      </div>
    </section>
  );
}
