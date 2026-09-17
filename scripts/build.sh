#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
rm -rf dist
mkdir -p dist/assets
tsc -p tsconfig.json
cp index.html dist/index.html
cp -R public/. dist/

if [[ -f "$ROOT/config.local.js" ]]; then
  cp "$ROOT/config.local.js" dist/config.js
  printf '%s\n' "Using machine-local config.local.js."
else
  printf '%s\n' "Using tracked Local-mode public/config.js."
fi

printf '%s\n' "Built dist/ with zero runtime npm dependencies."
