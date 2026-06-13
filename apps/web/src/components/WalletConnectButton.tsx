import { useAccount, useConnect, useDisconnect, useEnsName } from "wagmi";

import { shortAddress } from "../lib/dashboardFormat";

export function WalletConnectButton() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: ensName } = useEnsName({ address: address ?? undefined });
  const primary = connectors.find((c) => c.id === "injected") || connectors[0];

  if (isConnecting) {
    return (
      <button
        className="btn-secondary h-10 px-3 text-xs font-semibold opacity-60"
        disabled
        type="button"
      >
        Connecting…
      </button>
    );
  }

  if (isConnected && address) {
    const display = ensName || shortAddress(address);
    return (
      <button
        className="btn-secondary h-10 px-3 text-xs font-semibold font-mono"
        type="button"
        onClick={() => disconnect()}
        title={`Viewer wallet: ${address}. Cycles sign with the server agent EOA — not this wallet. Click to disconnect.`}
      >
        {display}
      </button>
    );
  }

  if (!primary) {
    return (
      <button
        className="btn-primary h-10 px-4 text-xs font-semibold opacity-60"
        disabled
        type="button"
      >
        No Wallet Found
      </button>
    );
  }

  return (
    <button
      className="btn-primary h-10 px-4 text-xs font-semibold disabled:opacity-60"
      disabled={isPending}
      type="button"
      onClick={() => connect({ connector: primary })}
      title={
        error
          ? error.message
          : "Optional viewer wallet — AMEO cycles sign with the server agent EOA, not your browser wallet."
      }
    >
      {isPending ? "…" : "Connect (viewer)"}
    </button>
  );
}
