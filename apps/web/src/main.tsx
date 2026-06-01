import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { WagmiProvider } from "wagmi";

import App from "./App";
import { SentryErrorFallback } from "./components/SentryErrorFallback";
import { AmeoUiProvider } from "./context/AmeoUiContext";
import { validateRuntimeConfig } from "./lib/runtimeConfig";
import { initSentry, Sentry } from "./sentry";
import { wagmiConfig } from "./wagmi";
import "./index.css";

initSentry();
validateRuntimeConfig();

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <SentryErrorFallback error={error} resetError={resetError} />
      )}
      showDialog={false}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <BrowserRouter
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
          >
            <AmeoUiProvider>
              <App />
            </AmeoUiProvider>
          </BrowserRouter>
        </WagmiProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
);
