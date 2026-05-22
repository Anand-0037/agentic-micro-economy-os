# AMEO — DoraHacks submission

**Project:** AMEO · Agentic Micro-Economy OS  
**Track:** 6 — Agentic Wallets & Economy (Byreal Skills CLI)  
**Stretch:** Grand Champion, Best UI/UX, Community Voting  
**Live:** https://ameo.agiwithai.com  
**Docs:** https://docs.ameo.agiwithai.com  
**Video:** _YouTube unlisted URL — fill before submit_

## Reviewer entry points

- [Verify in 60 seconds](./verify-in-60s.md)
- [Track 6 fit](./track-6-fit.md)
- [Public-good statement (BGA)](./public-good.md)

## One-liner

AMEO is a verifiable AI economic agent: it observes markets, reasons about actions, enforces hard risk policies, executes on-chain decisions, and cryptographically proves why every action happened.

## Why this matters

AMEO is trust infrastructure for verifiable cognition in autonomous finance on Mantle. The Narrative Console lets reviewers replay any cognition cycle from observation through policy guardrails, on-chain settlement, ERC-8004 identity proof, and 0G cryptographic receipts.

Autonomous treasuries are no longer hypothetical. Without verifiable cognition, operators and the public cannot independently audit *why* capital moved. AMEO treats auditability as public infrastructure — append-only worker events, hard policy guardrails, and explorer-verifiable settlement.

## Built on

Mantle Sepolia · Byreal Skills CLI · 0G Storage · ERC-8004 · z.ai (Tencent Cloud)

## Repo map for reviewers

- `docs/` — product documentation (also at [docs.ameo.agiwithai.com](https://docs.ameo.agiwithai.com))
- `apps/web/` — frontend (Vite + React + Tailwind)
- `apps/worker/` — Python worker (FastAPI + LangGraph)
- `packages/contracts/` — Solidity contracts (Foundry)

## Submission checklist

| Item | URL / hash | Done |
|------|------------|------|
| Live Narrative Console or Docker path | https://ameo.agiwithai.com/app | [ ] |
| Demo video (≤ 4 min) | | [ ] |
| GitHub repo | | [ ] |
| DecisionLogged tx (Mantle testnet) | https://sepolia.mantlescan.xyz/tx/ | [ ] |
| MantleAgentIdentity (ERC-8004) deployed | see `agent-context/runbooks/locked.md` §4 | [ ] |
| Cognition replay route `/app/replay` | | [ ] |
| eval_report.json sample | `examples/eval_report.sample.json` | [ ] |

Platform: https://dorahacks.io/hackathon/mantleturingtesthackathon2026/detail
