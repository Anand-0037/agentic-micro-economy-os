# Track 6 — Agentic Wallets & Economy (honest fit)

AMEO delivers a **verifiable autonomous treasury agent** for Track 6: persistent identity (ERC-8004-inspired NFT), policy-enforced decisioning, real on-chain settlement on Mantle Sepolia, and full cryptographic replay via events + 0G.

## Execution reality (no theater)

- Primary path: Direct, audited `MantleDexAdapter` (web3.py) → FusionX V2 router (fallback treasury_ping on testnet liquidity gaps, surfaced in UI).
- Quote / skills surface: `mantle.swap.v1` telemetry (price signals only). Settlement always via direct FusionX V2 adapter in `mantle_dex.py`.
- All labels in the live console accurately say "FusionX V2 DEX".
- The `/v1/skills` registry and event telemetry remain for future agentic wallet composability.

## Agentic wallet + identity

- `MantleAgentIdentity` (ERC-8004-inspired) at `0xEc14f781DB5f5f350F26Bc10Fb8f654e1D91daCc`
- Successful policy-approved executions attempt `DecisionLogged` under the agent token.
- `/v1/verify/{tx}` now returns full on-chain proof **or** transparent "execution evidence only" for older/partial cycles (radical transparency, not 404s).

## Economy surfaces

| Surface | Purpose |
| --- | --- |
| Worker + `/v1/*` | Observable, policy-gated agent loop |
| `@ameo/sdk` + `@ameo/mcp` | Programmable + agent-native access |
| Narrative Console | Judge-grade replay of every cognition step |

## Recommended reviewer command (fresh, working)

```bash
# 1. Hit the live console, trigger or watch a cycle, copy a real tx hash
# 2. Verify it
curl -s https://agentic-micro-economy-os.onrender.com/v1/verify/{real_tx_from_console}
```

The response will clearly state proof type (`onchain_decision_logged` or `execution_evidence_only`).
