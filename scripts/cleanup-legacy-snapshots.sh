#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# These were manual pre-Git-style snapshots from early development. They are
# not imported, built, deployed, or needed for rollback now that release tarballs
# and source control/history exist.
find src tests -type f \( -name '*.pre-*' -o -name '*.bak-*' \) -print -delete
