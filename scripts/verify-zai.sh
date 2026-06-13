#!/usr/bin/env bash
# Prove z.ai returns completions before switching LLM_PROVIDER=z_ai on Render.
set -euo pipefail

: "${Z_AI_API_KEY:?Set Z_AI_API_KEY}"
BASE_URL="${Z_AI_BASE_URL:-https://api.z.ai/api/paas/v4}"
MODEL="${Z_AI_MODEL:-glm-4.6}"

echo "==> z.ai probe: ${BASE_URL} model=${MODEL}"

RESP=$(curl -sS -w "\n%{http_code}" \
  -H "Authorization: Bearer ${Z_AI_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"${MODEL}\",\"messages\":[{\"role\":\"user\",\"content\":\"Reply with exactly: zai_ok\"}],\"max_tokens\":16}" \
  "${BASE_URL}/chat/completions")

BODY=$(echo "$RESP" | head -n -1)
CODE=$(echo "$RESP" | tail -n 1)

echo "HTTP ${CODE}"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"

if [[ "$CODE" != "200" ]]; then
  echo "FAIL: try Z_AI_BASE_URL=https://api.z.ai/api/coding/paas/v4 if you have a coding-plan key"
  exit 1
fi

CONTENT=$(echo "$BODY" | jq -r '.choices[0].message.content // empty')
if [[ -z "$CONTENT" ]]; then
  echo "FAIL: empty completion"
  exit 1
fi

echo "OK: z.ai returned: ${CONTENT}"
