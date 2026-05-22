import { defineChain } from "viem";

import { mantleRpcUrls } from "../lib/mantleRpc";

const chainId = Number(import.meta.env.VITE_MANTLE_CHAIN_ID ?? 5003);

export const mantleChain = defineChain({
  id: chainId,
  name: chainId === 5003 ? "Mantle Sepolia" : "Mantle",
  nativeCurrency: {
    name: "Mantle",
    symbol: "MNT",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: mantleRpcUrls(),
    },
  },
  blockExplorers: {
    default: {
      name: "Mantlescan",
      url:
        import.meta.env.VITE_MANTLE_EXPLORER_BASE ??
        "https://sepolia.mantlescan.xyz",
    },
  },
});
