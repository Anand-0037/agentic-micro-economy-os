const explorerBase =
  import.meta.env.VITE_MANTLE_EXPLORER_BASE ?? "https://sepolia.mantlescan.xyz";
const treasuryEoa = import.meta.env.VITE_TREASURY_EOA;
const agentIdentityAddress = import.meta.env.VITE_AGENT_IDENTITY_ADDRESS;
const agentTokenId = import.meta.env.VITE_AGENT_TOKEN_ID ?? "0";
const zeroGIndexerBase =
  import.meta.env.VITE_0G_INDEXER_URL ?? "https://indexer-storage-testnet-turbo.0g.ai";
const byrealDocsUrl =
  (import.meta.env as ImportMetaEnv & { VITE_BYREAL_DOCS_URL?: string }).VITE_BYREAL_DOCS_URL ??
  "https://byreal.io";

const chips = [
  {
    icon: "🪙",
    title: "MNT-paid gas",
    sub: "Every cycle settles in MNT on Mantle Sepolia",
    href: treasuryEoa ? `${explorerBase}/address/${treasuryEoa}` : explorerBase,
  },
  {
    icon: "🛠️",
    title: "Byreal Skills CLI",
    sub: "Plan → signed call → broadcast",
    href: byrealDocsUrl,
  },
  {
    icon: "🪪",
    title: "ERC-8004 identity",
    sub: `Agent #${agentTokenId} · verifiable on-chain`,
    href: agentIdentityAddress
      ? `${explorerBase}/address/${agentIdentityAddress}#code`
      : explorerBase,
  },
  {
    icon: "🧠",
    title: "0G Storage receipts",
    sub: "Every rationale anchored, indexer-verified",
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
          AI x RWA-ready: drop-in for autonomous DAO, foundation, or microfinance treasuries.
        </p>
      </div>
    </section>
  );
}
