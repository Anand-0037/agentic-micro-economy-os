// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title MantleAgentIdentity (ERC-8004-inspired)
/// @notice ERC-8004-inspired identity; not a full EIP-8004 implementation.
/// @dev History lives in DecisionLogged events; storage holds latest snapshot only.
contract AgentIdentity is ERC721, Ownable {
    uint256 public nextTokenId;
    mapping(uint256 => bytes32) public lastRationaleHash;
    mapping(uint256 => bytes32) public lastActionHash;
    mapping(uint256 => string) public lastMetadataUri;

    event DecisionLogged(
        uint256 indexed agentId,
        bytes32 rationaleHash,
        string actionType,
        string metadataUri,
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
        string calldata actionType,
        string calldata metadataUri
    ) external {
        require(ownerOf(agentId) == msg.sender, "Not agent owner");
        lastRationaleHash[agentId] = rationaleHash;
        lastActionHash[agentId] = keccak256(bytes(actionType));
        lastMetadataUri[agentId] = metadataUri;
        emit DecisionLogged(agentId, rationaleHash, actionType, metadataUri, msg.sender);
    }
}
