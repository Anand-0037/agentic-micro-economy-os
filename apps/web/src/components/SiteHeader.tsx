import { useEffect, useMemo, useState } from "react";
import { NavLink, useSearchParams } from "react-router-dom";
import { useEvalNav } from "../hooks/useEvalNav";
import { useReplayNav } from "../hooks/useCycles";
import { OperatorSettingsSheet } from "./OperatorSettingsSheet";
import { SettingsIcon } from "./ui/SettingsIcon";
import { WalletConnectButton } from "./WalletConnectButton";
import { runtimeConfig } from "../lib/runtimeConfig";

const logoSrc = "/ameo-logo.png";

function navClass(active: boolean) {
  return `block rounded px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:px-2 md:py-1.5 md:text-[0.65rem] md:font-semibold md:uppercase md:tracking-[0.16em] ${
    active
      ? "bg-sand text-ink md:border-b-2 md:border-accent md:bg-transparent"
      : "text-muted hover:bg-sand/80 hover:text-ink md:hover:bg-transparent"
  }`;
}

type SiteHeaderProps = {
  basePath?: string;
};

export function SiteHeader({ basePath = "/app" }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const { showEvalTab } = useEvalNav();
  const { showReplayTab } = useReplayNav();
  const identityConfigured = Boolean(runtimeConfig.agentIdentityAddress);

  useEffect(() => {
    if (searchParams.get("settings") === "1") {
      setSettingsOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("settings");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const navItems = useMemo(() => {
    const items: { segment: string; label: string }[] = [
      { segment: "", label: "Treasury" },
    ];
    if (showReplayTab) {
      items.push({ segment: "replay", label: "Replay" });
    }
    if (identityConfigured) {
      items.push({ segment: "decisions", label: "Decisions" });
    }
    if (showEvalTab) {
      items.push({ segment: "eval", label: "Eval" });
    }
    return items;
  }, [identityConfigured, showEvalTab, showReplayTab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen || settingsOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen, settingsOpen]);

  const href = (segment: string) =>
    segment ? `${basePath}/${segment}` : basePath;

  const navLinks = (
    <>
      {navItems.map(({ segment, label }) => (
        <NavLink
          key={segment || "index"}
          className={({ isActive }) => navClass(isActive)}
          end={segment === ""}
          to={href(segment)}
          onClick={() => setMenuOpen(false)}
        >
          {label}
        </NavLink>
      ))}
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 md:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <NavLink className="flex min-w-0 items-center gap-3" to={basePath}>
                <img
                  src={logoSrc}
                  alt="AMEO"
                  className="h-10 w-10 shrink-0 border border-border bg-surface object-contain p-1"
                />
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-[0.28em] text-muted">AMEO</p>
                  <p className="truncate text-sm font-semibold">Narrative Console</p>
                </div>
              </NavLink>
              {identityConfigured && (
                <a
                  href={`${runtimeConfig.explorerBase}/address/${runtimeConfig.agentIdentityAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hidden sm:inline-flex items-center gap-1 rounded bg-[#e2f0d9] px-2 py-0.5 text-[10px] font-bold text-[#3d7a5f] border border-[#3d7a5f]/20 hover:bg-[#d6ebd0] transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3d7a5f]"></span>
                  Identity Verified
                </a>
              )}
            </div>

            <nav
              aria-label="Primary"
              className="hidden items-center gap-1 lg:flex lg:gap-2"
            >
              {navLinks}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                aria-label="Open settings"
                onClick={() => setSettingsOpen(true)}
              >
                <SettingsIcon />
              </button>
              <WalletConnectButton />
              <button
                type="button"
                className="btn-secondary inline-flex h-10 w-10 items-center justify-center lg:hidden"
                aria-expanded={menuOpen}
                aria-controls="mobile-nav"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  {menuOpen ? (
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  ) : (
                    <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {menuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-ink/20 lg:hidden"
              aria-label="Close menu overlay"
              onClick={() => setMenuOpen(false)}
            />
            <nav
              id="mobile-nav"
              aria-label="Mobile"
              className="fixed right-0 top-0 z-50 flex h-full w-[min(100%,280px)] flex-col gap-1 border-l border-border bg-bg p-4 pt-20 shadow-xl lg:hidden"
            >
              {navLinks}
              <button
                type="button"
                className="mt-2 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted hover:bg-sand/80"
                aria-label="Open settings"
                onClick={() => {
                  setMenuOpen(false);
                  setSettingsOpen(true);
                }}
              >
                <SettingsIcon />
              </button>
              <NavLink
                className="mt-4 block text-sm text-muted underline-offset-4 hover:underline"
                to="/"
                onClick={() => setMenuOpen(false)}
              >
                ← Back to landing
              </NavLink>
            </nav>
          </>
        ) : null}
      </header>

      <OperatorSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
