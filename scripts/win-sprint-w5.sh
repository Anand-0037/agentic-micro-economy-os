#!/usr/bin/env bash
set -euo pipefail

: "${AGENT_IDENTITY_ADDRESS:?env AGENT_IDENTITY_ADDRESS required (e.g. 0xB86dC64573089D8DD89C5686010295bB4412D652)}"
: "${MANTLESCAN_API_KEY:?env MANTLESCAN_API_KEY required for ABI lookup}"

echo "==> [1/4] Checking Mantlescan ABI status for $AGENT_IDENTITY_ADDRESS"
ABI=$(curl -fsS "https://api-sepolia.mantlescan.xyz/api?module=contract&action=getabi&address=${AGENT_IDENTITY_ADDRESS}&apikey=${MANTLESCAN_API_KEY}")
echo "$ABI" | python3 -c "import sys,json; d=json.load(sys.stdin); print('VERIFIED' if d.get('status')=='1' else 'NOT_VERIFIED:', d.get('message',''))"

echo "==> [2/4] Running scripts/exec-smoke.py × 5 with 90s cooldown"
for i in 1 2 3 4 5; do
  echo "    -> smoke $i/5"
  apps/worker/.venv/bin/python scripts/exec-smoke.py
  [ "$i" -lt 5 ] && sleep 90
done

echo "==> [3/4] Querying /api/decisions"
COUNT=$(curl -fsS "${VITE_WORKER_URL:-http://localhost:8000}/api/decisions" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('logs', d if isinstance(d, list) else [])))")
echo "    -> DecisionLogged events in /api/decisions: $COUNT"
[ "$COUNT" -ge 5 ] || { echo "FAIL: need >= 5"; exit 1; }

echo "==> [4/4] Writing latest 5 tx hashes to docs/assets/decision-logs-2026-05-22.md"
mkdir -p docs/assets
curl -fsS "${VITE_WORKER_URL:-http://localhost:8000}/api/decisions" \
| python3 -c "
import sys, json
data = json.load(sys.stdin)
logs = data.get('logs', data if isinstance(data, list) else [])
out = ['# Latest DecisionLogged events (W5)', '']
out += ['| # | Tx hash | Cycle | Block |', '|---|---|---|---|']
for i, d in enumerate(logs[-5:], 1):
    tx = d.get('txHash') or d.get('transactionHash') or '?'
    cycle = d.get('cycleId') or d.get('cycle_id') or '?'
    block = d.get('blockNumber') or d.get('block_number') or '?'
    out.append(f\"| {i} | [{tx[:10]}…](https://sepolia.mantlescan.xyz/tx/{tx}) | {cycle} | {block} |\")
print('\n'.join(out))
" > docs/assets/decision-logs-2026-05-22.md
echo "    -> wrote docs/assets/decision-logs-2026-05-22.md"

echo "==> ALL GREEN. Update README to include docs/assets/decision-logs-2026-05-22.md and screenshot Mantlescan source-verified panel."
