import { Outlet } from "react-router-dom";

import { AmeoDataProvider } from "../context/AmeoDataContext";
import { ChainGuard } from "./ChainGuard";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

type AppLayoutProps = {
  basePath?: string;
};

export function AppLayout({ basePath = "/app" }: AppLayoutProps) {
  return (
    <AmeoDataProvider>
      <div className="app-bg flex min-h-screen flex-col">
        <a
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:border-2 focus:border-ink focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
          href="#main-content"
        >
          Skip to content
        </a>
        <SiteHeader basePath={basePath} />
        <ChainGuard />
        <main className="flex-1" id="main-content">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </AmeoDataProvider>
  );
}
