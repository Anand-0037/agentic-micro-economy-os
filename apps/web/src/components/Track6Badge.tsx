import { Link } from "react-router-dom";

type Track6BadgeProps = {
  compact?: boolean;
};

const hackathonUrl =
  "https://dorahacks.io/hackathon/mantleturingtesthackathon2026/detail";

export function Track6Badge({ compact = false }: Track6BadgeProps) {
  return (
    <a
      className={`inline-flex items-center gap-1.5 border-2 border-accent bg-surface font-semibold text-ink transition-colors hover:bg-sand ${
        compact
          ? "rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider"
          : "rounded-full px-3 py-1.5 text-xs"
      }`}
      href={hackathonUrl}
      rel="noreferrer"
      target="_blank"
    >
      <span aria-hidden="true">🎯</span>
      <span>
        Track 6 · Agentic Wallets &amp; Economy · Byreal Skills CLI
      </span>
    </a>
  );
}

export function Track6BadgeInline() {
  return (
    <Link className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline" to="/">
      Track 6 · Agentic Wallets &amp; Economy
    </Link>
  );
}
