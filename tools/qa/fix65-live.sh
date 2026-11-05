#!/bin/sh
# fix65-a: (re)start one headless live.ts session on ports 4895/4896 and wait until /look answers.
# usage: sh tools/qa/fix65-live.sh <level> <quality> <run dir> [extra live.ts args]
level=$1; quality=$2; dir=$3; shift 3
pkill -f "tools/playtest/live.ts --screen --step --autofight" 2>/dev/null
sleep 2
mkdir -p "$dir"
E2E_PORT=4895 LIVE_PORT=4896 MI_BROWSER_POOL=1 BROWSER_POOL=on LUNA_RUN_DIR="$dir" nohup node --import tsx/esm tools/playtest/live.ts --screen --step --autofight --level "$level" --quality "$quality" "$@" > "$dir/live.log" 2>&1 &
for i in $(seq 1 120); do
  if curl -s 127.0.0.1:4896/look > /dev/null 2>&1; then echo ready; exit 0; fi
  sleep 2
done
echo "live did not start"; tail -20 "$dir/live.log"; exit 1
