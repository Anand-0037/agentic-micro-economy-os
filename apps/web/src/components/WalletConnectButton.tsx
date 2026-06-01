import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const primary = connectors[0];

  if (isConnected && address) {
    return (
      <button
        className="btn-secondary h-10 px-3 text-xs font-semibold"
        type="button"
        onClick={() => disconnect()}
        title={address}
      >
        Wallet
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
    >
      {isPending ? "…" : "Connect"}
    </button>
  );
}
