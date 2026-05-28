# Track 6 — Agentic Wallets & Economy

AMEO satisfies Track 6 by pairing an ERC-8004 agent identity with a Byreal Skills CLI execution surface and verifiable settlement on Mantle Sepolia.

## Byreal Skills CLI

- Worker log line: `[INFO] byreal_skill_invocation skill=mantle.swap.v1 …` in `apps/worker/ameo_worker/adapters/mantle_dex.py`
- Replay node: **Execution · via Byreal Skills CLI** in `apps/web/src/components/CycleReplayCard.tsx`
- Proof rail chip: `apps/web/src/components/MantleProofRail.tsx`
- Registry endpoint: `GET /v1/skills` → `mantle.swap.v1` / `byreal-cli`

## Agentic wallet

- Identity: `MantleAgentIdentity` at `0x8aC72a4B26e973FCdD7dAadd960Ae0eC635b4197`
- Every cycle emits `DecisionLogged` under token id `0`
- Treasury EOA rotated in W16 (public address in `.env.example`)

## Economy / protocol surfaces

| File | Purpose |
| --- | --- |
| `apps/worker/ameo_worker/routes/v1.py` | Public REST API |
| `packages/sdk` | `@ameo/sdk` TypeScript client |
| `packages/mcp` | `@ameo/mcp` stdio MCP server |
| `docs/api/v1.mdx` | API reference |

## Verify endpoint for reviewers

```bash
curl -s https://agentic-micro-economy-os.onrender.com/v1/verify/0xdab19668f7c21501a01b04829b98cfbdb38f125fedabcb6cea86fbd6ec02ecf8
```

Returns rationale hash, action type, Mantlescan URL, and decision status in one JSON object.
