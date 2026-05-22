import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";

const DEMO_STORAGE_KEY = "ameo.demoMode";

export type DemoModeContextValue = {
  demoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  /** Hide bootstrap empty-state callouts (fund treasury, etc.). */
  hideBootstrapCallouts: boolean;
};

const DemoModeContext = createContext<DemoModeContextValue | null>(null);

function readStoredDemoMode(): boolean {
  try {
    return localStorage.getItem(DEMO_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const [demoMode, setDemoModeState] = useState(readStoredDemoMode);

  useEffect(() => {
    const demoParam = searchParams.get("demo");
    if (demoParam === "1") {
      setDemoModeState(true);
      try {
        localStorage.setItem(DEMO_STORAGE_KEY, "1");
      } catch {
        /* ignore */
      }
    } else if (demoParam === "0") {
      setDemoModeState(false);
      try {
        localStorage.removeItem(DEMO_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [searchParams]);

  const setDemoMode = useCallback((enabled: boolean) => {
    setDemoModeState(enabled);
    try {
      if (enabled) {
        localStorage.setItem(DEMO_STORAGE_KEY, "1");
      } else {
        localStorage.removeItem(DEMO_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      demoMode,
      setDemoMode,
      hideBootstrapCallouts: demoMode,
    }),
    [demoMode, setDemoMode],
  );

  return (
    <DemoModeContext.Provider value={value}>{children}</DemoModeContext.Provider>
  );
}

export function useDemoMode(): DemoModeContextValue {
  const ctx = useContext(DemoModeContext);
  if (!ctx) {
    throw new Error("useDemoMode must be used within DemoModeProvider");
  }
  return ctx;
}
