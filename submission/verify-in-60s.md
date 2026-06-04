# Verify in 60 seconds (honest, no theater)

**Core thesis:** Every material action by the agent is either (a) logged as a `DecisionLogged` event under the on-chain identity, or (b) has transparent local execution evidence with a real Mantle tx. The `/v1/verify` endpoint now surfaces both cases honestly.

1. **Identity contract (ERC-8004-inspired, verified)**  
   https://sepolia.mantlescan.xyz/address/0xEc14f781DB5f5f350F26Bc10Fb8f654e1D91daCc#code

2. **Recent real settlement tx (with DecisionLogged when logging succeeded)**  
   Use any recent `action_executed` tx from the live console or run a fresh cycle.

3. **API proof (works for both full on-chain logs and execution-only evidence)**  
   https://agentic-micro-economy-os.onrender.com/v1/verify/{any_real_tx_hash_from_worker}

   The endpoint first checks on-chain `DecisionLogged`, then falls back to local event evidence (no more 404s on real past executions).

4. **Live Narrative Console + full replay**  
   https://ameo.agiwithai.com

**Note on older hero txs:** Some very early executions pre-date the identity logger. The verify endpoint now clearly labels them as "execution_evidence_only" instead of hiding the gap. This is intentional transparency.
