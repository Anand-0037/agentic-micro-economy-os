# Contracts

Foundry project for AMEO contracts.

## Setup

```bash
forge install OpenZeppelin/openzeppelin-contracts
forge install foundry-rs/forge-std
forge build
```

## Deploy

```bash
forge script script/DeployAgentIdentity.s.sol --rpc-url $MANTLE_RPC --private-key $AGENT_PRIVATE_KEY --broadcast
```
