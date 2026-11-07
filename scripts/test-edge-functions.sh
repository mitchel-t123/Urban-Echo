#!/usr/bin/env bash
# Type-checks and tests the Supabase edge functions under Deno.
#
#   bash scripts/test-edge-functions.sh
#
# Needs Node/npm only. Deno itself is fetched from npm on first use (pinned).
# Set DENO_BIN to use a Deno you already have.
set -euo pipefail
cd "$(dirname "$0")/.."

DENO_VERSION=2.1.4
if [ -n "${DENO_BIN:-}" ]; then
  DENO="$DENO_BIN"
else
  DENO="npx --yes deno@${DENO_VERSION}"
fi

echo "== type-check (real jose and supabase-js types) =="
$DENO check --no-lock --node-modules-dir=none --import-map=scripts/edge/import_map.check.json \
  supabase/functions/invite-crew/index.ts \
  supabase/functions/rentman-proxy/index.ts

echo
echo "== tests (real jose, fake Clerk network and database) =="
$DENO test -A --no-lock --node-modules-dir=none --import-map=scripts/edge/import_map.test.json scripts/edge/
