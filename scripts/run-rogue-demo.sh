#!/usr/bin/env bash
# Generate the winning policy-block demo: $900 rogue trade vs $250 cap.
set -euo pipefail

WORKER_URL="${WORKER_URL:-https://agentic-micro-economy-os.onrender.com}"
WORKER_URL="${WORKER_URL%/}"

echo "==> Warming worker..."
curl -sf "${WORKER_URL}/health" >/dev/null || true

echo "==> LLM chain (must be z_ai before recording video)..."
curl -s "${WORKER_URL}/api/llm-chain" | jq '.active_provider, .available_providers'

echo "==> Running rogue-block cycle (demo=rogue_block)..."
RESP=$(curl -s -X POST "${WORKER_URL}/run-cycle?demo=rogue_block")
echo "$RESP" | jq '.'

CYCLE=$(echo "$RESP" | jq -r '.cycle_id // empty')
echo "==> Cycle: ${CYCLE:-unknown}"

if [[ -n "$CYCLE" ]]; then
  sleep 2
  echo "==> Cycle detail (decision_log match)..."
  curl -s "${WORKER_URL}/api/cycles/${CYCLE}" | jq '.summary, .decision_log, .policy_checks'
fi

echo "==> Decisions count..."
curl -s "${WORKER_URL}/api/decisions" | jq '.count'

echo "Done. Record video when active_provider=z_ai and decision_log is populated."
