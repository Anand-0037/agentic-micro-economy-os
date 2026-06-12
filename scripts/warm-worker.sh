#!/usr/bin/env bash
# Ping the Render worker so judges don't hit a cold start. Run every 10–14 min via cron or UptimeRobot.
set -euo pipefail

WORKER_URL="${WORKER_URL:-https://agentic-micro-economy-os.onrender.com}"
URL="${WORKER_URL%/}/health"

if curl -fsS --max-time 30 "$URL" >/dev/null; then
  echo "ok: $URL"
else
  echo "fail: $URL" >&2
  exit 1
fi
