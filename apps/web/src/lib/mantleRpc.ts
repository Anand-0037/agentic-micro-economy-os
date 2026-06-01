/** Real Mantle Sepolia RPC endpoints (ordered). Official RPC first; avoid DRPC SSL issues. */
export function mantleRpcUrls(): string[] {
  const fromEnv = [
    import.meta.env.VITE_MANTLE_RPC_URL,
    import.meta.env.VITE_MANTLE_RPC_URL_FALLBACK,
  ].filter((url): url is string => Boolean(url));

  const defaults = [
    "https://rpc.sepolia.mantle.xyz",
    "https://rpc.ankr.com/mantle_sepolia",
  ];

  return [...new Set([...fromEnv, ...defaults])];
}
