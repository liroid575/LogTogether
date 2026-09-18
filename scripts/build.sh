#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
rm -rf dist
mkdir -p dist/assets
tsc -p tsconfig.json
cp index.html dist/index.html
cp -R public/. dist/
node --input-type=module <<'NODE'
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
const walk = dir => readdirSync(dir,{withFileTypes:true}).flatMap(entry => entry.isDirectory() ? walk(`${dir}/${entry.name}`) : entry.name.endsWith('.js') ? [`/${dir.slice(5)}/${entry.name}`] : []);
const file='dist/sw.js';
writeFileSync(file,readFileSync(file,'utf8').replace('const SHELL = [',`const SHELL = [\n${walk('dist/assets').map(path=>JSON.stringify(path)+',').join('\n')}`));
NODE


if [[ -f "$ROOT/config.local.js" ]]; then
  cp "$ROOT/config.local.js" dist/config.js
  printf '%s\n' "Using machine-local config.local.js."
else
  printf '%s\n' "Using tracked Local-mode public/config.js."
fi

printf '%s\n' "Built dist/ with zero runtime npm dependencies."
