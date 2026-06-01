# AMEO submission bundle

**Live console:** https://ameo.agiwithai.com  
**Docs:** https://docs.ameo.agiwithai.com  
**Repo:** https://github.com/Anand-0037/agentic-micro-economy-os  
**Worker API:** https://agentic-micro-economy-os.onrender.com  
**npm:** `@ameo/sdk`, `@ameo/mcp` (publish after local test)

## Entry points

- [Verify in 60 seconds](./verify-in-60s.md)
- [Track 6 fit](./track-6-fit.md)
- [Public-good statement](./public-good.md)

## Surfaces shipped (honest, audited)

| Surface | Location |
| --- | --- |
| REST API v1 | `GET /v1/verify/{txHash}` (now honest partial-proof fallback), `POST /v1/decisions` |
| TypeScript SDK | `packages/sdk` → `@ameo/sdk` |
| MCP server | `packages/mcp` → `@ameo/mcp` |
| Verified identity (ERC-8004-inspired) | `0x8aC72a4B26e973FCdD7dAadd960Ae0eC635b4197` on Mantle Sepolia |
| Direct Mantle execution | Real web3 txs via Merchant Moe/FusionX (no fake hashes) |
