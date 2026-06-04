import { parseAbi } from "viem";

export const agentIdentityAbi = parseAbi([
  // Full ERC-8004-inspired event (updated contract)
  "event DecisionLogged(uint256 indexed agentId, bytes32 rationaleHash, int256 signedPnL1e18, string actionType, string metadataUri, string dataHash, address operator)",
]);
