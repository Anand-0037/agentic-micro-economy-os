# AMEO — Verifiable cognition for autonomous agents on Mantle

Trust infrastructure for autonomous finance — standard-setting cryptographic accountability for on-chain AI agents. AMEO observes treasury state, reasons under policy, executes on Mantle Sepolia, and returns explorer-verifiable proof for every decision.

- **REST API** — `/v1/*` on the worker (`/v1/verify/{txHash}` for one-shot proof)
- **TypeScript SDK** — `@ameo/sdk` npm package
- **MCP server** — `@ameo/mcp` for Claude Desktop and Cursor
- **Narrative Console** — live replay at [ameo.agiwithai.com](https://ameo.agiwithai.com)

## Confirm it works in under a minute

| Step | What you'll see | Link |
| --- | --- | --- |
| 1. The agent is a real contract | Verified Solidity on Mantlescan | [`0x8aC7…4197`](https://sepolia.mantlescan.xyz/address/0x8aC72a4B26e973FCdD7dAadd960Ae0eC635b4197#code) |
| 2. It has actually acted | `DecisionLogged` event for cycle `cyc_df716921` | [tx `0xdab1…ecf8`](https://sepolia.mantlescan.xyz/tx/0xdab19668f7c21501a01b04829b98cfbdb38f125fedabcb6cea86fbd6ec02ecf8) |
| 3. API proof in one call | `/v1/verify/{txHash}` JSON | [worker `/v1/verify/0xdab1…ecf8`](https://agentic-micro-economy-os.onrender.com/v1/verify/0xdab19668f7c21501a01b04829b98cfbdb38f125fedabcb6cea86fbd6ec02ecf8) |
| 4. You can replay it visually | 9-node walkthrough in the live console | [ameo.agiwithai.com/app/replay?cycle=cyc_df716921](https://ameo.agiwithai.com/app/replay?cycle=cyc_df716921) |

## What it does, in four steps

1. **Observe** — reads wallet balances, gas prices, and market signals from Mantle Sepolia.
2. **Decide** — an LLM proposes an action (swap, hold, rebalance). The reasoning is hashed and stored on 0G Storage.
3. **Check** — a policy engine rejects the action if it breaks any of 7 hard rules (max drawdown, asset whitelist, trade-size cap, gas budget, etc.).
4. **Execute & log** — if the action passes, AMEO invokes the Byreal Skills CLI path, settles on Mantle Sepolia, and writes a `DecisionLogged` event to its ERC-8004 identity contract.

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

Or one-shot with Docker: `docker compose up --build`. Console at `http://localhost:5173`, API at `http://localhost:8000`.

Deployed worker API: https://agentic-micro-economy-os.onrender.com

## Safety choices, said plainly

- The agent's signing key is a hot EOA in a `.env` file. That's fine for a testnet demo. For production, swap in KMS or MPC. We've isolated the key path so this is a one-file change.
- Sepolia DEXes have thin liquidity, so when a swap can't fill cleanly, the agent falls back to a self-transfer (`treasury_ping`) that still proves the policy → signing → RPC path. We surface this honestly in the UI.
- The LLM has a fallback chain: z.ai → Groq → Gemini → local rules. If every provider is down, the agent **refuses to act** rather than guessing.

## Docs

- [Quickstart](docs/quickstart.mdx)
- [Architecture](docs/architecture.mdx)
- [Policy spec](docs/policy-spec.mdx)
- [Worker API](docs/api/worker-api.mdx)
- [Why this matters](docs/why-it-matters.mdx)