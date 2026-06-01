import { Link } from "react-router-dom";

import { Badge, BadgeVariant } from "./ui/Badge";

type Track6BadgeProps = {
  compact?: boolean;
};

const hackathonUrl =
  "https://dorahacks.io/hackathon/mantleturingtesthackathon2026/detail";

export function Track6Badge({ compact = false }: Track6BadgeProps) {
  return (
    <a href={hackathonUrl} rel="noreferrer" target="_blank" className="inline-flex">
      <Badge variant={BadgeVariant.Mantle} compact={compact}>
        <span aria-hidden="true">🎯</span>
        <span>Agentic Wallets · Mantle Sepolia Treasury</span>
      </Badge>
    </a>
  );
}

export function Track6BadgeInline() {
  return (
    <Link className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline" to="/">
      Agentic Wallets &amp; Economy
    </Link>
  );
}
