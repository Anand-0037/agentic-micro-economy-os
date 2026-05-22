import { parseAbi } from "viem";

export const agentIdentityAbi = parseAbi([
  "event DecisionLogged(uint256 indexed agentId, bytes32 rationaleHash, int256 pnl1e18, string actionType, string metadataUri, string dataHash, address operator)",
]);
