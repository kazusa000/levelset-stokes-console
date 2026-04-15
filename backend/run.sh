#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
VENV="$ROOT_DIR/.venv"

if [[ -f "$ROOT_DIR/.env" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
fi

if [[ ! -x "$VENV/bin/uvicorn" ]]; then
  echo "Missing backend venv. Run:" >&2
  echo "  python3 -m venv $VENV" >&2
  echo "  $VENV/bin/pip install -r $SCRIPT_DIR/requirements.txt" >&2
  exit 1
fi

cd "$SCRIPT_DIR"
exec "$VENV/bin/uvicorn" app:app --host 127.0.0.1 --port 8000 --reload
