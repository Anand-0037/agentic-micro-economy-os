import { Link } from "react-router-dom";

import { CognitionTimeline } from "../components/CognitionTimeline";
import { LocalErrorBoundary } from "../components/LocalErrorBoundary";
import { LiveProtocolStats } from "../components/LiveProtocolStats";
import { MantleProofRail } from "../components/MantleProofRail";
import { VerifyIn60sCard } from "../components/VerifyIn60sCard";
import { Badge, BadgeVariant } from "../components/ui/Badge";
import { runtimeConfig } from "../lib/runtimeConfig";

const logoSrc = "/ameo-logo.png";

// NOTE: This should be dynamically pulled from recent cycles with real txs.
// Using a static old tx is risky after the verify hardening changes.
// Dynamic proof cards — avoid any static old/broken tx hashes.
// The VerifyIn60sCard below handles live recent cycles properly.
const proofCards = [
  {
    title: "On-chain identity",
    label: "Decision ledger · Mantle Sepolia",
    href: `${runtimeConfig.explorerBase}/address/${runtimeConfig.agentIdentityAddress}#code`,
  },
  {
    title: "Policy + skills API",
    label: "Guardrails + registered capabilities",
    href: `${runtimeConfig.workerUrl.replace(/\/$/, "")}/v1/policies`,
  },
  {
    title: "Live Narrative Console",
    label: "Watch real cycles + replay any past decision",
    href: "/app/replay",
  },
  {
    title: "Full worker API",
    label: "Verify, decisions, skills, agents",
    href: `${runtimeConfig.workerUrl.replace(/\/$/, "")}/docs`,
  },
];

export function LandingPage() {
  const identityUrl = `${runtimeConfig.explorerBase}/address/${runtimeConfig.agentIdentityAddress}#code`;

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
          <div className="flex items-center gap-3">
            <a
              className="hidden text-sm font-semibold text-muted hover:text-ink sm:inline"
              href={runtimeConfig.docsUrl}
              rel="noreferrer"
              target="_blank"
            >
              Docs ↗
            </a>
            <Link
              className="neo-button inline-flex h-10 items-center bg-accent px-4 text-sm font-semibold text-surface"
              to="/app"
            >
              Open Console
            </Link>
          </div>
        </div>
      </header>

      <main>
        <VerifyIn60sCard variant="landing" />
        <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16 lg:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-[3fr_2fr] lg:gap-12">
            <div>
          <div className="mb-4 flex flex-wrap gap-2">
                <Badge variant={BadgeVariant.Mantle} compact>
                  Track 01 · AI Trading &amp; Strategy · Turing Test 2026
                </Badge>
                <Badge variant={BadgeVariant.Chain}>Mantle Sepolia</Badge>
                <Badge variant={BadgeVariant.Policy}>Policy Guardrails</Badge>
                <Badge variant={BadgeVariant.Verified}>Verifiable Decisions</Badge>
              </div>
              <h1 className="max-w-2xl font-display text-4xl font-semibold leading-tight md:text-5xl">
                Policy guardrails LLMs cannot bypass.
              </h1>
              <p className="mt-6 max-w-xl text-lg text-muted">
                A policy-enforced AI trading agent on Mantle that proves — with on-chain
                DecisionLogged events — when it refused a risky trade the LLM tried to make.
              </p>
              <LiveProtocolStats />
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  className="neo-button inline-flex h-12 items-center bg-accent px-6 text-sm font-semibold text-surface"
                  to="/app"
                >
                  Open treasury console →
                </Link>
                <a
                  className="inline-flex h-12 items-center px-2 text-sm font-semibold text-ink underline-offset-4 hover:underline"
                  href={identityUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Verify contract ↗
                </a>
              </div>
            </div>

            <div className="min-w-0">
              <LocalErrorBoundary title="Cognition timeline failed to render.">
                <CognitionTimeline autoLoop hideHeader pauseOnHover />
              </LocalErrorBoundary>
            </div>
          </div>
        </section>

        <MantleProofRail />
        <p className="mx-auto max-w-3xl px-4 pb-8 text-center text-sm text-muted md:px-6">
          Policy enforcement outside the LLM. Every decision verifiable on-chain. When every provider
          is down, the agent still enforces guardrails and refuses unsafe actions.
        </p>

        <section className="border-t border-border bg-surface py-14 md:py-16">
          <div className="mx-auto max-w-6xl px-4 md:px-6">
            <h2 className="font-display text-2xl font-semibold text-ink">
              Verify any decision in 60 seconds
            </h2>
            <p className="mt-2 text-sm text-muted max-w-2xl">
              Policy checks, execution traces, and rationale hashes — all independently verifiable
              on Mantle. No mocks — tamper-evident proofs on-chain.
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {proofCards.map((card) => (
                <article key={card.title} className="neo-card-sm p-5">
                  <h3 className="font-display text-base font-semibold text-ink">{card.title}</h3>
                  <p className="mt-2 text-xs uppercase tracking-wider text-muted">{card.label}</p>
                  <a
                    className="mt-4 inline-flex text-sm font-semibold text-accent underline-offset-4 hover:underline"
                    href={card.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open ↗
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
            <p className="font-display font-semibold">AMEO · Policy-bound agents</p>
            <p className="mt-1 text-sm text-muted">
              Guardrails enforced outside the LLM · Verifiable on Mantle
            </p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link className="hover:underline" to="/app">
              Console
            </Link>
            <Link className="hover:underline" to="/app/replay">
              Replay
            </Link>
            <a className="hover:underline" href={runtimeConfig.docsUrl} rel="noreferrer" target="_blank">
              Docs
            </a>
            <a
              className="hover:underline"
              href={`${runtimeConfig.workerUrl.replace(/\/$/, "")}/v1/skills`}
              rel="noreferrer"
              target="_blank"
            >
              API
            </a>
          </div>
          <p className="text-xs text-muted">© 2026 AMEO · MIT</p>
        </div>
      </footer>
    </div>
  );
}
