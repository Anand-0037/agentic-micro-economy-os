import { createContext, useContext, type ReactNode } from "react";

import { useAmeoQueries } from "../hooks/useAmeo";

export type AmeoData = ReturnType<typeof useAmeoQueries>;

const AmeoDataContext = createContext<AmeoData | null>(null);

export function AmeoDataProvider({ children }: { children: ReactNode }) {
  const value = useAmeoQueries();
  return (
    <AmeoDataContext.Provider value={value}>{children}</AmeoDataContext.Provider>
  );
}

export function useAmeo(): AmeoData {
  const ctx = useContext(AmeoDataContext);
  if (!ctx) {
    throw new Error("useAmeo must be used within AmeoDataProvider");
  }
  return ctx;
}
