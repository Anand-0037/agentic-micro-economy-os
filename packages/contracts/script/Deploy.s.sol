// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

import {AgentIdentity} from "../src/MantleAgentIdentity.sol";

contract Deploy is Script {
    function run() external returns (AgentIdentity) {
        vm.startBroadcast();
        AgentIdentity identity = new AgentIdentity();
        vm.stopBroadcast();
        return identity;
    }
}
