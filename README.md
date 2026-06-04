# AMEO — Policy guardrails for autonomous agents on Mantle

Trust infrastructure for autonomous finance. AMEO enforces policy guardrails **outside the LLM** — before execution, not after. Every decision produces a permanent, independently verifiable record on Mantle via ERC-8004-inspired identity + 0G Storage + DecisionLogged events.

**Three defining features:**
1. **Policy enforcement outside the LLM** — 7 guardrails checked before every execution (max drawdown, asset whitelist, trade size, gas budget, etc.)
2. **Verifiable decisions** — Every rationale, policy check, and execution trace is independently checkable on-chain
3. **Radical transparency** — Live observable agents that adapt and self-correct under policy constraints

- **REST API** — `/v1/*` on the worker (`/v1/verify/{txHash}` for one-shot proof)
- **TypeScript SDK** — `@ameo/sdk` npm package
- **MCP server** — `@ameo/mcp` for Claude Desktop and Cursor
- **Narrative Console** — live replay at [ameo.agiwithai.com](https://ameo.agiwithai.com)

## Confirm it works in under a minute (no mocks, honest proof)

| Step | What you'll see | Link |
| --- | --- | --- |
| 1. Verified agent contract | ERC-8004-inspired identity on Mantlescan | [`0xEc14…1daCc`](https://sepolia.mantlescan.xyz/address/0xEc14f781DB5f5f350F26Bc10Fb8f654e1D91daCc#code) |
| 2. Real execution tx | Any recent `DecisionLogged` event from the live console | Open https://ameo.agiwithai.com |
| 3. API verification | `/v1/verify/{txHash}` — returns full policy checks + execution proof | Worker verify endpoint |
| 4. Full decision replay | Every policy check, rationale, and settlement trace | [ameo.agiwithai.com/app/replay](https://ameo.agiwithai.com/app/replay) |

The verify endpoint returns transparent proof for every decision — policy checks, rationale hashes, and execution traces.

## How policy enforcement works

1. **Observe** — reads wallet balances, gas prices, and market signals from Mantle Sepolia.
2. **Decide** — an LLM proposes an action (swap, hold, rebalance). The reasoning is hashed and stored on 0G Storage.
3. **Policy check (outside LLM)** — 7 hard rules are checked **before execution**:
   - Max drawdown limit (12% cap)
   - Asset whitelist (USDC, MNT only)
   - Trade size cap ($500 max)
   - Gas budget limit
   - Minimum balance requirements
   - Slippage tolerance
   - Execution frequency limits
4. **Execute & log** — if the action passes all policy checks, AMEO settles via FusionX V2 DEX adapter (or treasury_ping testnet fallback), then emits `DecisionLogged` on the identity contract with full policy proof.

**Key insight:** Policy enforcement happens in deterministic Python code, not in the LLM. The LLM can propose anything — policy decides what actually executes.

## Links

- Live: https://ameo.agiwithai.com
- Docs: https://docs.ameo.agiwithai.com
- Repo: https://github.com/Anand-0037/agentic-micro-economy-os

## What's inside

| Piece | Tech | Purpose |
| --- | --- | --- |
| Worker | Python, FastAPI, LangGraph | Runs the observe → decide → check → execute loop |
| Web console | React, Vite, Tailwind, wagmi | Watch the agent live, replay any past cycle |
| Identity contract | Solidity 0.8.24, ERC-8004 + ERC-721 | One NFT = one agent. Every decision is an event under this NFT. |
| Policy engine | Pure-Python rules (drawdown, exposure, whitelist) | Catches bad ideas before they touch the chain |
| Storage | 0G testnet | Permanent, addressable record of every reasoning trace |
| Settlement | Mantle Sepolia | Cheap, fast, MNT-paid gas |

## Architecture

AMEO is built around **verifiable cognition**: every agent decision produces independently auditable artifacts (observation snapshot, LLM-or-rules plan, deterministic policy checks, execution trace, 0G-anchored rationale, on-chain `DecisionLogged`).

Policy enforcement is **outside the LLM** in pure Python. The LLM only proposes; the guardrails decide.

### System Diagram

```mermaid
flowchart TB
    subgraph Users["Users / Operators / Auditors / MCP Clients"]
        UI["Narrative Console (Web UI)<br/>React + TanStack Query + framer-motion + wagmi<br/>Dashboard, Replay, Decisions, Eval"]
        SDK["@ameo/sdk (TypeScript)"]
        MCP["@ameo/mcp Server<br/>Claude Desktop / Cursor tools"]
    end

    subgraph Worker["Worker Service (FastAPI + LangGraph)"]
        direction TB
        HTTP["REST API + SSE<br/>/v1/* (decisions, cycles, verify/{tx}, policy, status, events/tail)"]
        Sched["APS Scheduler<br/>(30min production ticks) + Runner loop"]
        Graph["LangGraph Agent<br/>State: observation, plan, guardrail_ok, execution..."]
        subgraph Cycle["Cognition Cycle (per run_cycle)"]
            direction LR
            N1["1. observe<br/>Mantle balances/gas + Bybit signals"]
            N2["2. delta_neutral (lp_add + perps_hedge_proxy when vol high)"]
            N3["3. reason<br/>LLM (P-001 prompt) or rules fallback"]
            N4["4. plan<br/>Quote telemetry only"]
            N5["5. guardrail<br/>PolicyEngine + GuardrailService<br/>(deterministic, outside LLM)"]
            N6["6. act<br/>MantleDexAdapter (FusionX) or no_op/ping"]
            N7["7. self_heal (retries on RPC)"]
            N8["8. log + finalize_async"]
        end
        Final["finalize: 0G anchor + onchain logDecision"]
        PersistW["EventStore (JSONL) + MemoryDB (SQLite) + CycleStore"]
    end

    subgraph External["External Systems"]
        direction LR
        LLMs["LLM Providers<br/>z.ai (default) → Groq → Gemini → local_rules"]
        MNT["Mantle Sepolia<br/>RPC • FusionX V2 Router • AgentIdentity"]
        ZG["0G Storage (Galileo testnet)<br/>CLI upload full trace JSON → root hash"]
        Signals["Bybit Public API (market context)"]
    end

    subgraph OnChain["On-Chain (Mantle Sepolia)"]
        ID["AgentIdentity.sol<br/>ERC-721 per agent<br/>DecisionLogged events (rationaleHash, signedPnL1e18, actionType, metadataUri, dataHash)"]
        DEX["DEX Routers (settlement)"]
    end

    %% Flows
    UI -->|poll + SSE + manual trigger| HTTP
    SDK -->|decisions.create, verify, agents| HTTP
    MCP -->|register_agent, submit_decision, verify_decision| HTTP

    Sched -->|run_cycle| Graph
    HTTP -->|run_cycle| Graph
    Graph --> N1 --> N2 --> N3 --> N4 --> N5 --> N6 --> N7 --> N8 --> Final
    N3 <--> LLMs
    N1 --> MNT
    N6 --> MNT
    Final -->|full trace JSON| ZG
    Final -->|logDecision(..., rationaleHash, metadataUri=0Groot)| ID
    N5 -->|violations / pass| PersistW
    N8 -->|structured events| PersistW
    Final -->|history, PnL, learnings| PersistW

    MNT -.->|DecisionLogged + tx receipt| HTTP
    ID -.->|view / address on Mantlescan| UI
    ZG -.->|indexer lookup by root| UI

    PersistW -->|cycle detail replay from events| HTTP
    HTTP -->|reconstruct 8-node rail + proof| UI

    classDef layer fill:#f8f1e3,stroke:#3a2f1f
    classDef node fill:#fff,stroke:#666
    class Users,Worker,External,OnChain layer
```

### Cognition Loop Details (LangGraph nodes in `apps/worker/ameo_worker/graph.py`)

1. **observe** — Pull treasury balances (MNT/USDC), gas price, block, optional Bybit market context. Quality score.
2. **reason** — Structured LLM call (or rules_planner fallback on provider failure) producing `ActionPlan` (swap / no_op / ...). Injects recent learnings.
3. **plan** — Optional `mantle.swap.v1` quote telemetry invocation (non-settling).
4. **guardrail** — `GuardrailService` runs `PolicyEngine.validate` + extra checks (observation quality, balance sufficiency, gas spike, protocol whitelist, daily volume). **This is the trust boundary.**
5. **act** — If guardrail passes + live permitted + not idempotent duplicate → `MantleDexAdapter.execute_from_plan`. Falls back to treasury_ping on thin liquidity. Records notional.
6. **self_heal** — Limited backoff retries for transient RPC/timeout errors.
7. **log** — Record to SQLite (history/PnL/learnings), emit `cycle_completed`, kick off background `finalize_cycle_async`.
8. **finalize** (background) — Upload full trace (obs + plan + policy_checks + events + exec) to 0G → obtain root hash. If successful execution, call `logDecision` on identity contract (V1 sig for deployed contract) with `rationaleHash` (keccak of rationale) + `metadataUri` (0G root) + PnL.

All steps emit typed events to daily `logs/events/events_YYYYMMDD.jsonl` for deterministic replay.

### Data & Proof Model

- **SQLite** (`data/ameo.db` or configured `MEMORY_DB_PATH`): execution_history, pnl_snapshots, learnings. Used for `/api/history`, performance, trophies.
- **JSONL events**: append-only source of truth for cycle reconstruction. Powers `/api/cycles/{id}` and the Replay UI's 8-node rail.
- **On-chain**: `DecisionLogged` on the `AgentIdentity` ERC-721 (deployed at `0xEc14f781DB5f5f350F26Bc10Fb8f654e1D91daCc`). `rationaleHash` commits to reasoning; `metadataUri` / `dataHash` point at 0G trace. (See broadcast/ for exact deployment tx.)
- **0G**: Full structured trace (including every `guardrail_evaluated` violation) is the permanent off-chain record. Verifiable via indexer root hash.
- **Verify path** (`/v1/verify/{txHash}`): on-chain match first → local event fallback (honest, no fabrication) → 404 with guidance.

Policy predicates (see `/v1/policies` and `guardrail_service.py` + `policy.py`): max_drawdown, max_position, asset_whitelist, protocol_whitelist, observation_quality, balance_sufficiency, gas_price_guard, daily_volume (in act).

### Packages & Clients

- `packages/contracts/` — Foundry, `MantleAgentIdentity.sol` (ERC-721 + logDecision), deploy scripts.
- `packages/sdk/` — `@ameo/sdk` thin TS client for the v1 surface (used by web + MCP).
- `packages/mcp/` — `@ameo/mcp` stdio server exposing 5 tools for agentic IDEs.
- `packages/prompts/` — Versioned system prompts (P-001 planner etc.) loaded by worker.
- `packages/shared/config/` — Token/chain constants.

### Deployment Topology (current)

- **Worker**: Render (python, `apps/worker`, `uvicorn`, disk for DB optional). Health at `/health`. Scheduler always on.
- **Frontend**: Vercel (`apps/web`). Env points at worker URL + contract addresses.
- **Chain**: Mantle Sepolia (chainId 5003). Hot EOA for testnet (documented safety choice).
- **Storage**: 0G testnet (CLI + wallet gas on Galileo).
- **Observability**: Sentry (worker + web), live logs via SSE.

Local: `uv run uvicorn ...` + `npm run dev`. See `scripts/` for smoke, bootstrap, live loop tests. `LIVE_ENABLED=false` / `WORKER_MODE=dry_run` by default.

### Key Safety & Honesty Properties

- Deterministic Python guardrails always run (even in dry_run or LLM outage).
- LLM never sees private keys.
- Fallback chain never silently guesses; degrades to rules or refuses.
- UI and verify explicitly surface "execution_evidence_only" or missing 0G cases instead of fabricating proof.
- Idempotency (plan hash 5m), daily notional caps, duplicate detection in hot path.
- Contracts are simple; full history lives in events + on-chain logs (no complex on-chain state machines).

See:
- [docs/architecture.mdx](docs/architecture.mdx) (source of truth for some diagrams)
- [docs/policy-spec.mdx](docs/policy-spec.mdx)
- [docs/concepts/verifiable-cognition.mdx](docs/concepts/verifiable-cognition.mdx)
- [apps/worker/ameo_worker/graph.py](apps/worker/ameo_worker/graph.py) (the loop)
- Live replay: https://ameo.agiwithai.com/app/replay

## Run it locally

```bash
# 1. Clone, copy env template
cp .env.example .env
# fill in: AGENT_PRIVATE_KEY, AGENT_IDENTITY_ADDRESS, MANTLE_RPC_URL, OPENAI/Z.AI/GROQ keys

# 2. Worker
cd apps/worker && uv sync && uv run uvicorn ameo_worker.main:app --reload

# 3. Web
cd apps/web && npm install && npm run dev
```

**Deploy:** Frontend on [Vercel](https://vercel.com) (`apps/web`). Worker on [Render](https://render.com) — see `render.yaml` and `apps/worker/scripts/render-build.sh`. Set `MEMORY_DB_PATH=data/ameo.db`, or attach a Render disk at `/data` and use `MEMORY_DB_PATH=/data/ameo.db`.

Deployed worker API: https://agentic-micro-economy-os.onrender.com

## Safety choices, said plainly

- **Policy enforcement is deterministic** — The 7 guardrails run in pure Python, not in the LLM. The LLM can propose anything; policy decides what executes.
- The agent's signing key is a hot EOA in a `.env` file. That's fine for a testnet demo. For production, swap in KMS or MPC. We've isolated the key path so this is a one-file change.
- Sepolia DEXes have thin liquidity, so when a swap can't fill cleanly, the agent falls back to a self-transfer (`treasury_ping`) that still proves the policy → signing → RPC path. We surface this honestly in the UI.
- The LLM has a fallback chain: z.ai → Groq → Gemini → local rules. If every provider is down, the agent **refuses to act** rather than guessing. Policy still enforces even when LLMs fail.

## Docs

- [Quickstart](docs/quickstart.mdx)
- [Architecture](docs/architecture.mdx)
- [Policy spec](docs/policy-spec.mdx)
- [Worker API](docs/api/worker-api.mdx)
- [Why this matters](docs/why-it-matters.mdx)
)
