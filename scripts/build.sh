#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
rm -rf dist
mkdir -p dist/assets
tsc -p tsconfig.json
cp index.html dist/index.html
cp -R public/. dist/
printf '%s\n' "Built dist/ with zero runtime npm dependencies."
