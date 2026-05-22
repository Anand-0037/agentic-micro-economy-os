#!/usr/bin/env bash
# Local deploy (when Docker is unavailable or for dev).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CLI="$ROOT/bin/0g-storage-client"
if [[ ! -x "$CLI" ]]; then
  echo "Building 0g-storage-client..."
  mkdir -p "$ROOT/bin"
  TMP="$(mktemp -d)"
  git clone --depth 1 https://github.com/0gfoundation/0g-storage-client.git "$TMP"
  (cd "$TMP" && go build -o "$CLI")
  rm -rf "$TMP"
fi

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo "Worker: http://localhost:8000"
echo "Web:    http://localhost:5173"
echo "Stop any existing processes on 8000/5173 first."

cd "$ROOT/apps/worker"
uv run uvicorn ameo_worker.main:app --host 0.0.0.0 --port 8000 &
WORKER_PID=$!

cd "$ROOT/apps/web"
npm run dev -- --host 0.0.0.0 --port 5173 &
WEB_PID=$!

trap 'kill $WORKER_PID $WEB_PID 2>/dev/null' EXIT

echo "PIDs worker=$WORKER_PID web=$WEB_PID"
wait
