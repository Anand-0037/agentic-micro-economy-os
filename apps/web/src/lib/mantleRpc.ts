/** Real Mantle Sepolia RPC endpoints (ordered). Official RPC rate-limits; use providers. */
export function mantleRpcUrls(): string[] {
  const fromEnv = [
    import.meta.env.VITE_MANTLE_RPC_URL,
    import.meta.env.VITE_MANTLE_RPC_URL_FALLBACK,
  ].filter((url): url is string => Boolean(url));

  const defaults = [
    "https://mantle-sepolia.drpc.org",
    "https://rpc.sepolia.mantle.xyz",
  ];

  return [...new Set([...fromEnv, ...defaults])];
}
