import { Link } from "react-router-dom";

import { CognitionTimeline } from "../components/CognitionTimeline";
import { MantleProofRail } from "../components/MantleProofRail";
import { VerifyIn60sCard } from "../components/VerifyIn60sCard";

const logoSrc = "/ameo-logo.png";

const explorerBase =
  import.meta.env.VITE_MANTLE_EXPLORER_BASE ?? "https://sepolia.mantlescan.xyz";
const agentIdentityAddress = import.meta.env.VITE_AGENT_IDENTITY_ADDRESS;

const verifiedTxHash =
  "0xdab19668f7c21501a01b04829b98cfbdb38f125fedabcb6cea86fbd6ec02ecf8";
const verifiedTxUrl = `${explorerBase}/tx/${verifiedTxHash}`;

const proofCards = [
  {
    title: "Verifiable Cognition",
    hash: verifiedTxHash,
    href: verifiedTxUrl,
    label: "Mantle settlement tx",
  },
  {
    title: "Hard Policy Guardrails",
    hash: verifiedTxHash,
    href: verifiedTxUrl,
    label: "Policy-bound execution proof",
  },
  {
    title: "0G Cryptographic Receipts",
    hash: verifiedTxHash,
    href: verifiedTxUrl,
    label: "Explorer-verifiable receipt anchor",
  },
];

const identityUrl = agentIdentityAddress
  ? `${explorerBase}/address/${agentIdentityAddress}`
  : `${explorerBase}/address/0x45e6f621c5ED8616cCFB9bBaeBAcF9638aBB0033`;

export function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link className="flex items-center gap-3" to="/">
            <img
              alt="AMEO"
              className="h-9 w-9 border-2 border-ink bg-surface object-contain p-0.5"
              src={logoSrc}
            />
            <span className="font-display text-sm font-semibold tracking-tight">AMEO</span>
          </Link>
          <Link
            className="neo-button inline-flex h-10 items-center bg-accent px-4 text-sm font-semibold text-surface"
            to="/app/replay"
          >
            Open Narrative Console
          </Link>
        </div>
      </header>

      <main>
        <VerifyIn60sCard variant="landing" />
        <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[3fr_2fr] lg:gap-12">
            <div>
              <p className="mb-4 inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
                Narrative Console · Mantle Sepolia
              </p>
              <h1 className="max-w-2xl font-display text-4xl font-semibold leading-tight md:text-5xl">
                Autonomous agents should not operate in darkness.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted">
                AMEO is the Narrative Console for verifiable AI economic agents. Observe,
                reason, enforce policy, execute on-chain, and cryptographically prove why every
                action happened.
              </p>
              <p className="mt-3 max-w-xl text-sm text-muted">
                Open, MIT-licensed infrastructure built so any autonomous treasury — DAO,
                foundation, microfinance pool — can be independently audited.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  className="neo-button inline-flex h-12 items-center bg-accent px-6 text-sm font-semibold text-surface"
                  to="/app/replay"
                >
                  Watch a cognition cycle →
                </Link>
                <a
                  className="inline-flex h-12 items-center px-2 text-sm font-semibold text-ink underline-offset-4 hover:underline"
                  href={identityUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Verify on Mantle ↗
                </a>
              </div>
            </div>

            <div className="min-w-0">
              <CognitionTimeline autoLoop hideHeader pauseOnHover />
            </div>
          </div>
        </section>

        <MantleProofRail />
        <p className="mx-auto max-w-3xl px-4 pb-8 text-center text-sm text-muted md:px-6">
          Survives any inference outage — when every LLM is down, the agent still enforces policy
          and refuses to act. That is what safety looks like.
        </p>

        <section className="border-t border-border bg-surface py-14 md:py-16">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <div className="grid gap-6 md:grid-cols-3">
              {proofCards.map((card) => (
                <article key={card.title} className="neo-card-sm p-5">
                  <h2 className="font-display text-lg font-semibold text-ink">{card.title}</h2>
                  <p className="mt-2 text-xs uppercase tracking-wider text-muted">{card.label}</p>
                  <p className="mt-3 break-all font-mono text-[11px] text-ink/80">{card.hash}</p>
                  <a
                    className="mt-4 inline-flex text-sm font-semibold text-accent underline-offset-4 hover:underline"
                    href={card.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View on Mantlescan ↗
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-sand py-10">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="font-display font-semibold">AMEO · Narrative Console</p>
            <p className="mt-1 text-sm text-muted">
              Trust infrastructure for verifiable autonomous finance on Mantle
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link className="hover:underline" to="/app/replay">
              Replay
            </Link>
            <Link className="hover:underline" to="/app">
              Console
            </Link>
            <a
              className="hover:underline"
              href="https://github.com/agiwithai/ameo/blob/main/submission/README.md"
              rel="noreferrer"
              target="_blank"
            >
              Submission
            </a>
          </div>
          <p className="text-xs text-muted">© 2026 AMEO · ERC-8004 identity · 0G receipts</p>
        </div>
      </footer>
    </div>
  );
}
