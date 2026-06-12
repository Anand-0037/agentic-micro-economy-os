import { Link } from "react-router-dom";

import { Badge, BadgeVariant } from "./ui/Badge";

type HackathonTrackBadgeProps = {
  compact?: boolean;
};

const hackathonUrl =
  "https://dorahacks.io/hackathon/mantleturingtesthackathon2026/detail";

/** DoraHacks Turing Test 2026 — AI Trading & Strategy (BGA-sponsored). */
export function Track6Badge({ compact = false }: HackathonTrackBadgeProps) {
  return (
    <a href={hackathonUrl} rel="noreferrer" target="_blank" className="inline-flex">
      <Badge variant={BadgeVariant.Mantle} compact={compact}>
        <span aria-hidden="true">🎯</span>
        <span>AI Trading &amp; Strategy (BGA) · Turing Test 2026</span>
      </Badge>
    </a>
  );
}

export function Track6BadgeInline() {
  return (
    <Link
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
      to="/"
    >
      AI Trading &amp; Strategy (BGA)
    </Link>
  );
}
