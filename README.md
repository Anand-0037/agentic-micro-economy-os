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
| 1. Verified agent contract | ERC-8004-inspired identity on Mantlescan | [`0x8aC7…4197`](https://sepolia.mantlescan.xyz/address/0x8aC72a4B26e973FCdD7dAadd960Ae0eC635b4197#code) |
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
4. **Execute & log** — if the action passes all policy checks, AMEO settles via Mantle DEX adapter (FusionX V2), then emits `DecisionLogged` on the identity contract with full policy proof.

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
| Policy engine | Pure-Python rules + JSON spec | Catches bad ideas before they touch the chain |
| Storage | 0G testnet | Permanent, addressable record of every reasoning trace |
| Settlement | Mantle Sepolia | Cheap, fast, MNT-paid gas |

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