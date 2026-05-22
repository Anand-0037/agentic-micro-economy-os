# Track 6 fit — Agentic Wallets & Economy

AMEO is submitted to **Track 6 · Agentic Wallets & Economy** (Byreal Skills CLI). The Narrative Console replay maps each cognition node to agentic wallet operations — observe, plan, authorize, sign, settle, and prove.

## What Byreal Skills CLI does in AMEO

The worker execution layer treats agentic wallet operations as a structured pipeline:

- **Observe** — read Mantle Sepolia treasury balances, gas, and market signals before any model call.
- **Plan** — compile a structured action plan (swap size, assets, protocol) with a hashed rationale.
- **Authorize** — deterministic policy predicates run outside the LLM; failed plans never reach signing.
- **Sign & broadcast** — the execution adapter constructs calldata and submits via an isolated hot EOA (Merchant Moe / FusionX router on Mantle Sepolia).
- **Prove** — `DecisionLogged` on `MantleAgentIdentity` plus optional 0G Storage receipt for the full reasoning blob.

This is the agentic wallet economy pattern Track 6 expects: wallet-connected cognition with verifiable authorization, not opaque automation.

## Where it appears in the cycle

| Replay node | Track 6 capability |
|-------------|-------------------|
| Observation snapshot | Wallet state extraction |
| Planner output | Structured trade intent |
| Policy validation | Pre-sign authorization gate |
| Execution · via Byreal Skills CLI | Signing adapter / calldata construction |
| Settled on Mantle Sepolia | On-chain settlement proof |
| DecisionLogged · ERC-8004 identity | Identity-bound decision log |
| 0G Storage receipt | Off-chain reasoning anchor |

UI labels match these nodes in `apps/web/src/components/CycleReplayCard.tsx` and the landing cognition timeline.

## Where to verify in the code

| Area | Path |
|------|------|
| Cognition loop (observe → plan → guard → act → log) | `apps/worker/ameo_worker/graph.py` |
| Policy gate (pre-sign authorization) | `apps/worker/ameo_worker/services/guardrail_service.py` |
| Mantle DEX execution adapter | `apps/worker/ameo_worker/adapters/mantle_dex.py` |
| On-chain identity + `DecisionLogged` | `packages/contracts/src/MantleAgentIdentity.sol` |
| Replay UI (9-node verification rail) | `apps/web/src/components/CycleReplayCard.tsx` |
| Track 6 badge (landing) | `apps/web/src/components/Track6Badge.tsx` |

Run one live cycle from the Narrative Console, then open `/app/replay?cycle=<id>` to walk the same path a Track 6 reviewer expects.
