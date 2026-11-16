#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo 'Usage: copy-skills.sh <skills.yaml> <output-folder>' >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js 18.17+ is required. Install it, then run npm ci in the skills repository.' >&2
  exit 1
fi

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/copy-skills.mjs" "$@"
