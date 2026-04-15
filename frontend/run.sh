#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -f "$SCRIPT_DIR/../.env" ]]; then
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/../.env"
fi

if [[ ! -d "$SCRIPT_DIR/node_modules" ]]; then
  echo "Missing frontend dependencies. Run: npm install" >&2
  exit 1
fi

cd "$SCRIPT_DIR"
exec npm run dev
