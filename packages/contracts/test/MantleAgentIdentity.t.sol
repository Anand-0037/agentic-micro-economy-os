// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AgentIdentity} from "../src/MantleAgentIdentity.sol";

contract AgentIdentityTest is Test {
    AgentIdentity public identity;
    address public owner = address(0x1);
    address public operator = address(0x2);

    function setUp() public {
        vm.prank(owner);
        identity = new AgentIdentity();
    }

    function testMintAndProfile() public {
        // Owner mints agent token 0 to operator
        vm.prank(owner);
        uint256 tokenId = identity.mintAgent(operator);
        assertEq(tokenId, 0);
        assertEq(identity.ownerOf(tokenId), operator);

        // Operator logs a decision
        bytes32 rationaleHash = keccak256("test_rationale");
        int256 pnl = 100 * 1e18; // 100 MNT
        string memory actionType = "swap";
        string memory metadataUri = "ipfs://test";
        string memory dataHash = "0x123";

        vm.prank(operator);
        identity.logDecision(tokenId, rationaleHash, pnl, actionType, metadataUri, dataHash);

        // Operator registers a capability
        vm.prank(operator);
        identity.registerCapability(tokenId, "policy-enforced-autonomous-finance-agent");

        // Verify profile view returns correct aggregates
        (
            bytes32 lastRationale,
            int256 lastPnL,
            int256 totalPnL,
            uint256 decisions,
            string memory lastMeta,
            string memory capability
        ) = identity.getAgentProfile(tokenId);

        assertEq(lastRationale, rationaleHash);
        assertEq(lastPnL, pnl);
        assertEq(totalPnL, pnl);
        assertEq(decisions, 1);
        assertEq(lastMeta, metadataUri);
        assertEq(capability, "policy-enforced-autonomous-finance-agent");
    }
}
