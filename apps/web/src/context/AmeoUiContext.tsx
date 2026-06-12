import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const DEFAULT_WORKER =
  import.meta.env.VITE_WORKER_URL ??
  "https://agentic-micro-economy-os.onrender.com";

export type AmeoUiContextValue = {
  workerUrl: string;
  setWorkerUrl: (url: string) => void;
  workerApiKey: string;
  setWorkerApiKey: (key: string) => void;
};

const AmeoUiContext = createContext<AmeoUiContextValue | null>(null);

function readStoredWorkerUrl(): string {
  try {
    return localStorage.getItem("ameo.worker_url") ?? DEFAULT_WORKER;
  } catch {
    return DEFAULT_WORKER;
  }
}

function readStoredApiKey(): string {
  try {
    return localStorage.getItem("ameo.worker_api_key") ?? (import.meta.env.VITE_WORKER_API_KEY ?? "");
  } catch {
    return import.meta.env.VITE_WORKER_API_KEY ?? "";
  }
}

export function AmeoUiProvider({ children }: { children: ReactNode }) {
  const [workerUrl, setWorkerUrlState] = useState(readStoredWorkerUrl);
  const [workerApiKey, setWorkerApiKeyState] = useState(readStoredApiKey);

  const setWorkerUrl = useCallback((url: string) => {
    setWorkerUrlState(url);
    try {
      localStorage.setItem("ameo.worker_url", url);
    } catch {
      /* ignore quota */
    }
  }, []);

  const setWorkerApiKey = useCallback((key: string) => {
    setWorkerApiKeyState(key);
    try {
      localStorage.setItem("ameo.worker_api_key", key);
    } catch {
      /* ignore quota */
    }
  }, []);

  const value = useMemo(
    () => ({ workerUrl, setWorkerUrl, workerApiKey, setWorkerApiKey }),
    [workerUrl, setWorkerUrl, workerApiKey, setWorkerApiKey],
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
