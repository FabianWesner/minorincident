#!/bin/sh
# Reserve every configured browser slot: a second lane must not start midway through a timing run.
# Use this instead of an outer e2e-lock wrapper for native performance measurements.
root=$(cd "$(dirname "$0")/../.." && pwd)
# Explicit shared admission for lanes instructed to leave the second slot free.
# Preflight remains mandatory; this mode does not promise exclusive GPU timing.
if [ "${MI_PERF_SHARED_BROWSER:-}" = 1 ] && [ "${MI_PERF_LOCK_HELD:-}" != 1 ]; then
  export E2E_UNITS=1 MI_PERF_LOCK_HELD=1 MI_PERF_SLOTS_HELD=1
  export MI_PERF_WAIT_DEADLINE=$(($(date +%s) + ${E2E_ADMISSION_TIMEOUT_SECONDS:-1800}))
  exec sh "$root/tools/e2e-lock.sh" python3 "$root/tools/browser-job.py" --seconds 595 -- sh "$0" "$@"
fi
if [ "${MI_PERF_SHARED_BROWSER:-}" != 1 ]; then
if [ "${MI_BROWSER_POOL_EXCLUSIVE:-}" = "" ] && [ "${E2E_LEGACY:-0}" != 1 ]; then
  exec node --import tsx "$root/tools/browser-pool/wrapper.ts" exclusive "$@"
fi
if ! command -v lockf >/dev/null 2>&1; then echo 'Quiet-run needs the browser pool or macOS lockf.' >&2; exit 70; fi
if [ "${MI_PERF_JOB_HELD:-}" != 1 ]; then
  export MI_PERF_JOB_HELD=1
  exec python3 "$root/tools/browser-job.py" -- sh "$0" "$@"
fi
if [ "${MI_PERF_LOCK_HELD:-}" != 1 ]; then
  if [ -n "${MI_E2E_LOCK_HELD:-}" ]; then
    printf '%s\n' 'Run quiet-run directly, without an outer e2e-lock (it owns the browser locks).' >&2
    exit 1
  fi
  export MI_PERF_ADMISSION_TIMEOUT_SECONDS="${E2E_ADMISSION_TIMEOUT_SECONDS:-1800}"
  case "$MI_PERF_ADMISSION_TIMEOUT_SECONDS" in ''|*[!0-9]*|0) printf '%s\n' 'E2E_ADMISSION_TIMEOUT_SECONDS must be a positive integer' >&2; exit 2;; esac
  export MI_PERF_WAIT_DEADLINE=$(($(date +%s) + MI_PERF_ADMISSION_TIMEOUT_SECONDS))
  export MI_PERF_SESSION_STARTED=$(date +%s)
  slots="${E2E_SLOTS:-2}"
  case "$slots" in ''|*[!0-9]*|0) printf '%s\n' 'E2E_SLOTS must be a positive integer' >&2; exit 2;; esac
  # Cover the legacy four-slot range during rollout and explicit four-unit runs too.
  # E2E_SLOTS=1 only serializes that caller; it does not make the whole Mac quiet.
  [ "$slots" -ge 4 ] || slots=4
  export MI_PERF_LOCK_HELD=1 MI_E2E_LOCK_HELD=1 MI_E2E_UNITS_HELD="$slots" MI_PERF_SLOTS_HELD="$slots"
  root=$(cd "$(dirname "$0")/../.." && pwd)
  cooldown="${E2E_LOCK:-/tmp/minor-incident-e2e.lock}.quiet-finished"
  started=$(mktemp "${TMPDIR:-/tmp}/minor-incident-quiet-start.XXXXXX") || exit 1
  trap 'rm -f "$started"' EXIT
  trap 'exit 130' INT
  trap 'exit 143' TERM
  # Nonblocking ordered acquisition releases partial reservations immediately.
  # Cap the owned command at ten minutes, including cleanup.
  set -- sh -c 'printf x > "$1"; cooldown=$2; shift 2; "$@"; rc=$?; date +%s > "$cooldown"; exit "$rc"' sh "$started" "$cooldown" python3 "$root/tools/browser-job.py" --seconds 595 -- sh "$0" "$@"
  slot=$((slots - 1))
  while [ "$slot" -ge 0 ]; do
    set -- lockf -s -t 0 -k "${E2E_LOCK:-/tmp/minor-incident-e2e.lock}.$slot" "$@"
    slot=$((slot - 1))
  done
  while [ "$(date +%s)" -lt "$MI_PERF_WAIT_DEADLINE" ]; do
    last=$(cat "$cooldown" 2>/dev/null || true)
    case "$last" in ''|*[!0-9]*) last=0;; esac
    if [ "$(($(date +%s) - last))" -lt 60 ]; then sleep 2; continue; fi
    : > "$started"
    "$@"; rc=$?
    if [ -s "$started" ] || [ "$rc" -ne 75 ]; then exit "$rc"; fi
    sleep 2
  done
  printf 'Quiet-run: admission exceeded %s seconds; report unmeasured coverage.\n' "$MI_PERF_ADMISSION_TIMEOUT_SECONDS" >&2
  exit 75
fi
fi
while :; do
  [ "$(date +%s)" -lt "$MI_PERF_WAIT_DEADLINE" ] || { printf 'Quiet-run: admission exceeded %s seconds; report unmeasured coverage.\n' "$MI_PERF_ADMISSION_TIMEOUT_SECONDS" >&2; exit 75; }
  # Match executables, not scheduler summaries quoting previous process commands.
  # Also catch native Chrome's --headless flag.
  # A single Vitest worker can occupy a core while loadavg is still below 3.
  # Measured during E25/E27 closure: phone transitions then exceeded 50 ms.
  wait_reasons=$(python3 - "$MI_PERF_SESSION_STARTED" <<'PY'
import re, subprocess, sys
import os, time
session = int(sys.argv[1])
os_pid = os.getpid()
try:
    rows = subprocess.check_output(['ps', '-axo', 'pid=,etime=,%cpu=,command='], text=True).splitlines()
except Exception as error:
    print(f'process scan unavailable; admission blocked: {error}')
    raise SystemExit(0)
def seconds(value):
    days, _, value = value.partition('-')
    parts = [int(x) for x in value.split(':')]
    n = sum(x * 60 ** i for i, x in enumerate(reversed(parts)))
    return n + int(days or 0) * 86400
busy = []
for row in rows:
    m = re.match(r'\s*(\d+)\s+(\S+)\s+([\d.]+)\s+(.*)', row)
    if not m: continue
    pid, age, cpu, cmd = int(m[1]), seconds(m[2]), float(m[3]), m[4]
    if pid == os_pid or not re.search(r'vitest|typescript/bin/tsc|node_modules/\.bin/tsc|headless|Blender|vite(?:\.js)? build', cmd, re.I): continue
    if age > 600 and cpu == 0 and int(time.time()) - age < session: continue
    busy.append(f'{pid} cpu={cpu:g}% age={age}s {cmd}')
print('\n'.join(busy))
PY
  )
  # The collector ignores its own scanner command line.
  wait_reasons=$(printf '%s\n' "$wait_reasons" | sed '/python3 - /d')
  if [ -z "$wait_reasons" ] && node -e 'process.exit(require("node:os").loadavg()[0] < 3 ? 0 : 1)'; then
    uptime
    if [ -n "${PERF_CONDITIONS_LOG:-}" ]; then
      node -e 'const fs=require("node:fs"),os=require("node:os");fs.appendFileSync(process.env.PERF_CONDITIONS_LOG,JSON.stringify({at:new Date().toISOString(),load:os.loadavg(),otherHeadlessChrome:0,localVitest:0,localTypecheck:0,localBlender:0,localBuild:0,browserSlots:Array.from({length:Number(process.env.MI_PERF_SLOTS_HELD||4)},(_,i)=>i),command:process.argv.slice(1)})+"\n")' "$@"
    fi
    printf '%s\n' 'Quiet-run preflight: load < 3; no local Vitest, typecheck, Blender, build or headless Chrome processes; all configured browser slots held.'
    root=$(cd "$(dirname "$0")/../.." && pwd)
    python3 "$root/tools/mac-gpu-guard.py" 1 || { sleep 2; continue; }
    exec "$@"
  fi
  now=$(date +%s)
  if [ "$((now - last_wait_log))" -ge 60 ] 2>/dev/null || [ -z "${last_wait_log:-}" ]; then
    printf 'Quiet-run waiting for admission; load=%s blockers:\n%s\n' "$(uptime)" "${wait_reasons:-browser/build/other admission pressure}"
    last_wait_log=$now
  fi
  remaining=$((MI_PERF_WAIT_DEADLINE - now))
  [ "$remaining" -le 20 ] || remaining=20
  [ "$remaining" -gt 0 ] || remaining=1
  sleep "$remaining"
done
