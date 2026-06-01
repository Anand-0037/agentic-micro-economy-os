// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title MantleAgentIdentity (ERC-8004-inspired v2)
/// @notice Stronger step toward ERC-8004 agent identity for hackathon audit.
/// @dev Not a full EIP-8004 registry (no capabilities/attestations yet).
///      History is the append-only DecisionLogged events (the source of truth).
///      This version adds signedPnL and explicit dataHash for better on-chain benchmarking.
contract AgentIdentity is ERC721, Ownable {
    uint256 public nextTokenId;

    mapping(uint256 => bytes32) public lastRationaleHash;
    mapping(uint256 => bytes32) public lastActionHash;
    mapping(uint256 => string) public lastMetadataUri;
    mapping(uint256 => int256) public lastSignedPnL;      // 1e18 precision
    mapping(uint256 => uint256) public decisionCount;     // simple on-chain reputation

    event DecisionLogged(
        uint256 indexed agentId,
        bytes32 rationaleHash,
        int256 signedPnL1e18,
        string actionType,
        string metadataUri,
        string dataHash,
        address operator
    );

    constructor() ERC721("MantleAgent", "MANTLE-AGENT") Ownable(msg.sender) {}

    function mintAgent(address operator) external onlyOwner returns (uint256) {
        uint256 tokenId = nextTokenId++;
        _mint(operator, tokenId);
        return tokenId;
    }

    function logDecision(
        uint256 agentId,
        bytes32 rationaleHash,
        int256 signedPnL1e18,
        string calldata actionType,
        string calldata metadataUri,
        string calldata dataHash
    ) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");

        lastRationaleHash[agentId] = rationaleHash;
        lastActionHash[agentId] = keccak256(bytes(actionType));
        lastMetadataUri[agentId] = metadataUri;
        lastSignedPnL[agentId] = signedPnL1e18;
        decisionCount[agentId] += 1;

        emit DecisionLogged(
            agentId,
            rationaleHash,
            signedPnL1e18,
            actionType,
            metadataUri,
            dataHash,
            msg.sender
        );
    }

    // Future ERC-8004 surface (stub for post-hackathon)
    function getAgentProfile(uint256 agentId) external view returns (
        bytes32 lastRationale,
        int256 lastPnL,
        uint256 decisions,
        string memory lastMeta
    ) {
        return (
            lastRationaleHash[agentId],
            lastSignedPnL[agentId],
            decisionCount[agentId],
            lastMetadataUri[agentId]
        );
    }
}
