import { parseAbi } from "viem";

export const agentIdentityAbi = parseAbi([
  "event DecisionLogged(uint256 indexed agentId, bytes32 rationaleHash, string actionType, string metadataUri)",
]);
