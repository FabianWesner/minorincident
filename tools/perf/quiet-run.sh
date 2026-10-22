#!/bin/sh
# Reserve every configured browser slot: a second lane must not start midway through a timing run.
# Use this instead of an outer e2e-lock wrapper for native performance measurements.
command -v lockf >/dev/null 2>&1 || exec "$@"
root=$(cd "$(dirname "$0")/../.." && pwd)
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
  # Include quiet preflight and allow five seconds for owned-process cleanup within 20 minutes.
  set -- sh -c 'printf x > "$1"; cooldown=$2; shift 2; "$@"; rc=$?; date +%s > "$cooldown"; exit "$rc"' sh "$started" "$cooldown" python3 "$root/tools/browser-job.py" --seconds 1195 -- sh "$0" "$@"
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
while :; do
  [ "$(date +%s)" -lt "$MI_PERF_WAIT_DEADLINE" ] || { printf 'Quiet-run: admission exceeded %s seconds; report unmeasured coverage.\n' "$MI_PERF_ADMISSION_TIMEOUT_SECONDS" >&2; exit 75; }
  # Match executables, not scheduler summaries quoting previous process commands.
  # Also catch native Chrome's --headless flag.
  # A single Vitest worker can occupy a core while loadavg is still below 3.
  # Measured during E25/E27 closure: phone transitions then exceeded 50 ms.
  if ! pgrep -fil '^/[^ ]*(chrome|Chromium).*headless|^/Applications/Google Chrome[.]app/Contents/MacOS/Google Chrome .*headless' >/dev/null && ! pgrep -f '^([^ ]*/)?[n]ode [^ ]*/node_modules/[.]bin/vitest( |$)' >/dev/null && node -e 'process.exit(require("node:os").loadavg()[0] < 3 ? 0 : 1)'; then
    uptime
    if [ -n "${PERF_CONDITIONS_LOG:-}" ]; then
      node -e 'const fs=require("node:fs"),os=require("node:os");fs.appendFileSync(process.env.PERF_CONDITIONS_LOG,JSON.stringify({at:new Date().toISOString(),load:os.loadavg(),otherHeadlessChrome:0,localVitest:0,browserSlots:Array.from({length:Number(process.env.MI_PERF_SLOTS_HELD||4)},(_,i)=>i),command:process.argv.slice(1)})+"\n")' "$@"
    fi
    printf '%s\n' 'Quiet-run preflight: load < 3; no local Vitest or headless Chrome processes; all configured browser slots held.'
    root=$(cd "$(dirname "$0")/../.." && pwd)
    python3 "$root/tools/mac-gpu-guard.py" 1 || { sleep 2; continue; }
    exec "$@"
  fi
  sleep 20
done
