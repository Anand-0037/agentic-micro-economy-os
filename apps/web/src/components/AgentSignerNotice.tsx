import { useAccount } from "wagmi";

import { useAmeoConfig } from "../hooks/useAmeoConfig";
import { shortAddress } from "../lib/dashboardFormat";

/**
 * AMEO cycles are signed server-side by the configured hot EOA (Render env).
 * Connecting a browser wallet does NOT change treasury balances or cycle signing.
 */
export function AgentSignerNotice({ compact = false }: { compact?: boolean }) {
  const { address, isConnected } = useAccount();
  const { config } = useAmeoConfig();
  const signingEoa = config.signing_eoa?.toLowerCase() ?? "";
  const connected = address?.toLowerCase() ?? "";
  const mismatch = isConnected && signingEoa && connected !== signingEoa;

  if (compact && !mismatch) {
    return (
      <p className="text-[10px] text-muted font-mono">
        Agent treasury · server signer{" "}
        <span className="text-ink">{signingEoa ? shortAddress(config.signing_eoa) : "—"}</span>
      </p>
    );
  }

  return (
    <div
      className={`rounded border px-3 py-2 text-xs font-mono ${
        mismatch
          ? "border-amber-400 bg-amber-50 text-amber-900"
          : "border-border bg-neutral-50 text-muted"
      }`}
      role="status"
    >
      <p className="font-semibold text-ink">
        Agent treasury (server signer):{" "}
        <span className="font-mono">{signingEoa ? shortAddress(config.signing_eoa) : "loading…"}</span>
      </p>
      {mismatch ? (
        <p className="mt-1">
          Your connected wallet ({shortAddress(address)}) is <strong>not</strong> used for cycles.
          Balances and signing always use the server hot EOA above — this is intentional for the
          hackathon demo (Render holds the key).
        </p>
      ) : (
        <p className="mt-1">
          Connect wallet is optional (viewer only). Run cycle signs with the server EOA, not your
          browser wallet.
        </p>
      )}
    </div>
  );
}
