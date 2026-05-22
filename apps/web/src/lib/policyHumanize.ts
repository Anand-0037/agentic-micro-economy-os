export type PolicySnapshot = {
  max_drawdown_pct?: number;
  max_position_usd?: number;
  max_asset_exposure_pct?: number;
  hedge_drift_pct?: number;
  allowed_assets?: string[];
  allowed_protocols?: string[];
  notes?: string;
};

export type PolicyDisplayRow = {
  label: string;
  value: string;
};

export function humanizePolicy(policy: PolicySnapshot): PolicyDisplayRow[] {
  const assets = policy.allowed_assets ?? [];
  const protocols = policy.allowed_protocols ?? [];

  return [
    {
      label: "Max drawdown",
      value:
        typeof policy.max_drawdown_pct === "number"
          ? `${(policy.max_drawdown_pct * 100).toFixed(0)}%`
          : "—",
    },
    {
      label: "Max position",
      value:
        typeof policy.max_position_usd === "number"
          ? `$${policy.max_position_usd.toLocaleString()}`
          : "—",
    },
    {
      label: "Asset exposure cap",
      value:
        typeof policy.max_asset_exposure_pct === "number"
          ? `${(policy.max_asset_exposure_pct * 100).toFixed(0)}% per asset`
          : "—",
    },
    {
      label: "Hedge rebalance drift",
      value:
        typeof policy.hedge_drift_pct === "number"
          ? `${(policy.hedge_drift_pct * 100).toFixed(1)}%`
          : "—",
    },
    {
      label: "Allowed assets",
      value:
        assets.length > 0
          ? assets.join(", ")
          : "All assets allowed (no whitelist)",
    },
    {
      label: "Allowed protocols",
      value:
        protocols.length > 0
          ? protocols.join(", ")
          : "All protocols allowed (no whitelist)",
    },
  ];
}

export function isPublicDocsUrl(url?: string): boolean {
  if (!url?.trim()) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host !== "localhost" && host !== "127.0.0.1" && !host.endsWith(".local");
  } catch {
    return false;
  }
}
