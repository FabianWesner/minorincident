#!/bin/sh
# fix65-a: (re)start one headless live.ts session on ports 4895/4896 and wait until /look answers.
# Only the session this script started is stopped (pid file), never a concurrent Luna run.
# usage: sh tools/qa/fix65-live.sh <level> <quality> <run dir> [extra live.ts args]
level=$1; quality=$2; dir=$3; shift 3
pidfile=test-results/fix65-a/live.pid
if [ -f "$pidfile" ]; then kill "$(cat "$pidfile")" 2>/dev/null; sleep 3; fi
mkdir -p "$dir"
E2E_PORT=4895 LIVE_PORT=4896 MI_BROWSER_POOL=1 BROWSER_POOL=on LUNA_RUN_DIR="$dir" nohup node --import tsx/esm tools/playtest/live.ts --screen --step --autofight --level "$level" --quality "$quality" "$@" > "$dir/live.log" 2>&1 &
echo $! > "$pidfile"
for i in $(seq 1 150); do
  if curl -s 127.0.0.1:4896/look > /dev/null 2>&1; then echo ready; exit 0; fi
  sleep 2
done
echo "live did not start"; tail -20 "$dir/live.log"; exit 1
