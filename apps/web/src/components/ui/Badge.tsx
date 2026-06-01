import type { ReactNode } from "react";

export enum BadgeVariant {
  Live = "live",
  Verified = "verified",
  Policy = "policy",
  Chain = "chain",
  Mantle = "mantle",
  Neutral = "neutral",
  Warn = "warn",
  Error = "error",
}

const variantClass: Record<BadgeVariant, string> = {
  [BadgeVariant.Live]: "border-ok bg-[#e2f0d9] text-ok",
  [BadgeVariant.Verified]: "border-ok bg-[#e2f0d9] text-ok",
  [BadgeVariant.Policy]: "border-ink bg-sand text-ink",
  [BadgeVariant.Chain]: "border-accent bg-accent/10 text-accent",
  [BadgeVariant.Mantle]: "border-[#8B5E3C] bg-[#F5EDE4] text-ink",
  [BadgeVariant.Neutral]: "border-border bg-surface text-muted",
  [BadgeVariant.Warn]: "border-warn bg-amber-50 text-amber-900",
  [BadgeVariant.Error]: "border-danger bg-red-50 text-red-700",
};

type BadgeProps = {
  variant: BadgeVariant;
  children: ReactNode;
  className?: string;
  compact?: boolean;
};

export function Badge({ variant, children, className = "", compact = false }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border-2 font-semibold ${variantClass[variant]} ${
        compact
          ? "rounded-full px-2.5 py-1 text-[10px] uppercase tracking-wider"
          : "rounded-full px-3 py-1.5 text-xs"
      } ${className}`}
    >
      {children}
    </span>
  );
}
