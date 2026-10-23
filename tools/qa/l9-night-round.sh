#!/bin/sh
# l9-night-look: capture the current dist/ (fresh preview server on E2E_PORT, default 4271) for the given combos.
#   sh tools/qa/l9-night-round.sh <tag> [combos="webgpu-low"] [zooms=1,1.5]
# vite preview caches the file list at start, so every round starts its own server and stops it afterwards.
tag=$1; port=${E2E_PORT:-4271}
[ "$port" = 3300 ] && { echo 'never port 3300' >&2; exit 2; }
vite=node_modules/.bin/vite; [ -x "$vite" ] || vite=../../../node_modules/.bin/vite
"$vite" preview --host 127.0.0.1 --port "$port" --strictPort --configLoader runner >/dev/null 2>&1 &
server=$!
trap 'kill $server 2>/dev/null' EXIT
i=0; until curl -sf "http://127.0.0.1:$port/" >/dev/null; do i=$((i+1)); [ $i -gt 60 ] && exit 1; sleep 1; done
for c in ${2:-webgpu-low}; do
  r=${c%-*}; q=${c#*-}; out="test-results/l9n/$tag-$c"; rm -rf "$out"
  E2E_UNITS=1 E2E_ADMISSION_TIMEOUT_SECONDS=3600 sh tools/e2e-lock.sh npx tsx tools/qa/l9-night-capture.ts "http://127.0.0.1:$port" "$r" "$q" "$out" "${3:-1,1.5}" 2>&1 | grep -v '^ *at ' | tail -2
  python3 tools/qa/l9-night-sheet.py "$out" "$out.jpg" 560
done
