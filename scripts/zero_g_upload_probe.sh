#!/usr/bin/env bash
# Verify 0G Storage CLI upload against configured .env (paste output to hack/STATUS.md).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${ZERO_G_RPC_URL:?Set ZERO_G_RPC_URL in .env}"
: "${ZERO_G_INDEXER_URL:?Set ZERO_G_INDEXER_URL in .env}"
: "${ZERO_G_PRIVATE_KEY:?Set ZERO_G_PRIVATE_KEY in .env (0G wallet — not Mantle key)}"
CLI="${ZERO_G_CLI_PATH:-0g-storage-client}"

if ! command -v "$CLI" >/dev/null 2>&1; then
  echo "ERROR: $CLI not found. Build from https://github.com/0gfoundation/0g-storage-client"
  exit 1
fi

PROBE="$(mktemp --suffix=.json)"
trap 'rm -f "$PROBE"' EXIT
printf '{"probe":"ameo-zero-g","ts":"%s"}\n' "$(date -Iseconds)" >"$PROBE"

echo "Uploading probe file via 0G Storage CLI..."
"$CLI" upload \
  --url "$ZERO_G_RPC_URL" \
  --key "$ZERO_G_PRIVATE_KEY" \
  --indexer "$ZERO_G_INDEXER_URL" \
  --file "$PROBE"

echo "OK — copy the root hash above into hack/STATUS.md"
