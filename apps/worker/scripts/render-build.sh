#!/usr/bin/env bash
# Render native Python build — exports uv.lock to requirements.txt for pip.
set -euo pipefail

curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="${HOME}/.local/bin:${HOME}/.cargo/bin:${PATH}"

uv export --format requirements.txt --no-hashes -o requirements.txt
pip install --upgrade certifi
pip install -r requirements.txt
