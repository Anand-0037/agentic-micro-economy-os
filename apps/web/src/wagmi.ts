import { createConfig, fallback, http } from "wagmi";
import { injected } from "wagmi/connectors";

import { mantleChain } from "./chain/mantle";
import { mantleRpcUrls } from "./lib/mantleRpc";

export const wagmiConfig = createConfig({
  chains: [mantleChain],
  connectors: [injected()],
  transports: {
    [mantleChain.id]: fallback(mantleRpcUrls().map((url) => http(url)), { rank: true }),
  },
});
