#!/bin/sh
# L6 real-input playtest (lane l6-weapons-flow). usage: sh tools/playtest/l6-weapons.sh <name> <female|male> <weapons|fists>
# weapons: seeds a campaign save from the L6-default preset (fire axe, bat | army MG, handgun, kick) through the game's
# own campaign API, then resumes it from the menu (Continue). fists: same L6 save with only fists and kick.
# Needs `npm run build`; preview on E2E_PORT (default 4061, never 3300); every browser session goes through tools/e2e-lock.sh.
set -e
name=$1; heroine=${2:-female}; kind=${3:-weapons}
out=test-results/playtest/$name
port=${E2E_PORT:-4061}
export E2E_PORT=$port
rm -rf "$out"; mkdir -p "$out"
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port "$port" --strictPort --configLoader runner >/dev/null 2>&1 &
srv=$!
trap 'kill $srv; rm -rf "$out/profile"' EXIT
for i in $(seq 1 60); do curl -sf "http://127.0.0.1:$port" >/dev/null && break; sleep 1; done
case "$kind" in weapons|fists) ;; *) echo "Expected weapons or fists" >&2; exit 64 ;; esac
E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/playtest/seed.ts "http://127.0.0.1:$port" "$out/profile" "$heroine" L6-default "$kind" > "$out/seed.json"
npx tsx tools/playtest/play.ts --no-skip --levels L6 --mode continue --entry continue --heroine "$heroine" --quality low --zoom 1.5 --level-minutes 20 --out "$out" --keep-profile
rm -rf "$out/profile"
