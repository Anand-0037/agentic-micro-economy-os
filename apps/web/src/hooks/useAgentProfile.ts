import { useQuery } from "@tanstack/react-query";
import { useAmeoUi } from "../context/AmeoUiContext";
import { apiGet } from "../lib/apiClient";
import { runtimeConfig } from "../lib/runtimeConfig";

export type AgentProfile = {
  tokenId: number;
  ownerAddress: string;
  identityContract: string;
  decisionCount: number;
  totalPnL?: string;
  capabilities?: string[];
  tokenURI?: string;
};

export function useAgentProfile() {
  const { workerUrl, workerApiKey } = useAmeoUi();
  const tokenId = Number(runtimeConfig.agentTokenId);

  return useQuery<AgentProfile>({
    queryKey: ["agentProfile", workerUrl, tokenId],
    queryFn: async () => {
      return apiGet<AgentProfile>(
        workerUrl,
        `/v1/agents/${tokenId}`,
        5000,
        workerApiKey,
      );
    },
    staleTime: 15000,
  });
}
