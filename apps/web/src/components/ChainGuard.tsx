import { useAccount, useChainId, useSwitchChain } from "wagmi";

import { mantleChain } from "../chain/mantle";

export function ChainGuard() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected || chainId === mantleChain.id) {
    return null;
  }

  return (
    <div
      className="border-b-2 border-ink bg-sand px-4 py-3 text-center text-sm"
      role="alert"
    >
      Wallet is on chain {chainId}. AMEO requires{" "}
      <strong>Mantle Sepolia ({mantleChain.id})</strong>.
      <button
        className="neo-button ml-3 inline-flex h-8 items-center bg-accent px-3 text-xs font-semibold uppercase tracking-wider text-surface disabled:opacity-60"
        disabled={isPending}
        type="button"
        onClick={() => switchChain({ chainId: mantleChain.id })}
      >
        {isPending ? "Switching…" : "Switch network"}
      </button>
    </div>
  );
}
