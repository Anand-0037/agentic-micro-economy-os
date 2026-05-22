import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const DEFAULT_WORKER =
  import.meta.env.VITE_WORKER_URL ?? "http://localhost:8000";

export type AmeoUiContextValue = {
  workerUrl: string;
  setWorkerUrl: (url: string) => void;
};

const AmeoUiContext = createContext<AmeoUiContextValue | null>(null);

function readStoredWorkerUrl(): string {
  try {
    return localStorage.getItem("ameo.worker_url") ?? DEFAULT_WORKER;
  } catch {
    return DEFAULT_WORKER;
  }
}

export function AmeoUiProvider({ children }: { children: ReactNode }) {
  const [workerUrl, setWorkerUrlState] = useState(readStoredWorkerUrl);

  const setWorkerUrl = useCallback((url: string) => {
    setWorkerUrlState(url);
    try {
      localStorage.setItem("ameo.worker_url", url);
    } catch {
      /* ignore quota */
    }
  }, []);

  const value = useMemo(
    () => ({ workerUrl, setWorkerUrl }),
    [workerUrl, setWorkerUrl],
  );

  return (
    <AmeoUiContext.Provider value={value}>{children}</AmeoUiContext.Provider>
  );
}

export function useAmeoUi(): AmeoUiContextValue {
  const ctx = useContext(AmeoUiContext);
  if (!ctx) {
    throw new Error("useAmeoUi must be used within AmeoUiProvider");
  }
  return ctx;
}
