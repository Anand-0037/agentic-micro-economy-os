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
forge script script/DeployAgentIdentity.s.sol:DeployAgentIdentity \
  --rpc-url https://rpc.sepolia.mantle.xyz \
  --private-key $DEPLOYER_KEY --broadcast --legacy
```

## Canonical Sepolia deployment (June 2026)

| | |
| --- | --- |
| Contract | `0xB86dC64573089D8DD89C5686010295bB4412D652` |
| Owner / agent signer | `0x59ffc8907beaA275F29B466BCB1D9BbfeaDAd165` |
| Token id | `0` (minted) |
| Verify | `forge verify-contract 0xB86d… src/MantleAgentIdentity.sol:AgentIdentity --chain-id 5003` |
