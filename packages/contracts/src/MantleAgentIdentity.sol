// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @title MantleAgentIdentity (ERC-8004-inspired v2)
/// @notice Stronger step toward ERC-8004 agent identity for hackathon audit.
/// @dev History is the append-only DecisionLogged + CapabilityRegistered events (the source of truth).
///      Supports basic profile aggregation (total PnL, decision count, last capability) and
///      a minimal tokenURI for the agent NFT. Deployed address may lag source until redeploy.
contract AgentIdentity is ERC721, Ownable {
    uint256 public nextTokenId;

    mapping(uint256 => bytes32) public lastRationaleHash;
    mapping(uint256 => bytes32) public lastActionHash;
    mapping(uint256 => string) public lastMetadataUri;
    mapping(uint256 => int256) public lastSignedPnL;      // 1e18 precision
    mapping(uint256 => uint256) public decisionCount;     // simple on-chain reputation
    mapping(uint256 => int256) public totalSignedPnL;     // cumulative PnL for reputation/aggregation (ERC-8004 style)
    mapping(uint256 => string) public lastCapability;     // basic capability attestation surface

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
        totalSignedPnL[agentId] += signedPnL1e18;  // aggregate for profile

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

    /// @notice Returns aggregated on-chain profile for the agent (decision history, PnL, capabilities).
    /// @dev Implements basic ERC-8004-inspired agent identity surface (profile + capability attestation).
    ///      Full history/attestations can be indexed from DecisionLogged + CapabilityRegistered events.
    function getAgentProfile(uint256 agentId) external view returns (
        bytes32 lastRationale,
        int256 lastPnL,
        int256 totalPnL,
        uint256 decisions,
        string memory lastMeta,
        string memory capability
    ) {
        return (
            lastRationaleHash[agentId],
            lastSignedPnL[agentId],
            totalSignedPnL[agentId],
            decisionCount[agentId],
            lastMetadataUri[agentId],
            lastCapability[agentId]
        );
    }

    /// @notice Minimal tokenURI for the agent NFT (ERC-721 standard).
    /// @dev Returns a docs link for now. Can be upgraded to on-chain metadata JSON or IPFS/0G later.
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        require(ownerOf(tokenId) != address(0), "ERC721: invalid token ID");
        return string(abi.encodePacked(
            "https://docs.ameo.agiwithai.com/agents/",
            Strings.toString(tokenId)
        ));
    }

    event CapabilityRegistered(
        uint256 indexed agentId,
        string capability,
        address operator
    );

    /// @notice Register a capability/attestation for this agent (e.g. "delta-neutral-yield", "verifiable-cognition").
    /// @dev Callable by the NFT owner (the agent operator). Emits for off-chain indexing / ERC-8004 attestations.
    function registerCapability(uint256 agentId, string calldata capability) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        lastCapability[agentId] = capability;
        emit CapabilityRegistered(agentId, capability, msg.sender);
    }
}
