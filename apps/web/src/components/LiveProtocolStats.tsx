import { runtimeConfig } from "../lib/runtimeConfig";
import { useLiveProtocolStats } from "../hooks/useLiveProtocolStats";
import { Badge, BadgeVariant } from "./ui/Badge";

export function LiveProtocolStats() {
  const { data, isLoading } = useLiveProtocolStats();
  const online = data?.online ?? false;
  const root = data?.root;
  const config = data?.config;

  const uptimeMin = root?.uptime_seconds ? Math.floor(root.uptime_seconds / 60) : null;

  return (
    <div className="mt-6 flex min-h-6 flex-wrap items-center gap-3">
      {isLoading && !data ? (
        <>
          <div className="h-6 w-24 animate-pulse rounded bg-border/50" aria-hidden />
          <div className="h-6 w-36 animate-pulse rounded bg-border/40" aria-hidden />
        </>
      ) : (
        <>
          <Badge variant={online ? BadgeVariant.Live : BadgeVariant.Warn}>
            {online ? "Worker live" : "Worker unreachable"}
          </Badge>
          <Badge variant={BadgeVariant.Chain}>
            Mantle Sepolia · {runtimeConfig.mantleChainId}
          </Badge>
          {root?.last_cycle_id ? (
            <Badge variant={BadgeVariant.Neutral} compact>
              Last cycle {root.last_cycle_id}
            </Badge>
          ) : null}
          {uptimeMin != null && online ? (
            <span className="text-xs text-muted tabular-nums">Uptime {uptimeMin}m</span>
          ) : null}
          {config?.daily_notional_usd_today != null && online ? (
            <span className="text-xs text-muted tabular-nums">
              Today ${config.daily_notional_usd_today.toFixed(2)} notional
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}
