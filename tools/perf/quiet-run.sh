#!/bin/sh
# Reserve every configured browser slot: a second lane must not start midway through a timing run.
# Use this instead of an outer e2e-lock wrapper for native performance measurements.
command -v lockf >/dev/null 2>&1 || exec "$@"
if [ "${MI_PERF_LOCK_HELD:-}" != 1 ]; then
  if [ -n "${MI_E2E_LOCK_HELD:-}" ]; then
    printf '%s\n' 'Run quiet-run directly, without an outer e2e-lock (it owns the browser locks).' >&2
    exit 1
  fi
  slots="${E2E_SLOTS:-3}"
  case "$slots" in ''|*[!0-9]*|0) printf '%s\n' 'E2E_SLOTS must be a positive integer' >&2; exit 2;; esac
  # Cover the legacy four-slot range during rollout and explicit four-unit runs too.
  # E2E_SLOTS=1 only serializes that caller; it does not make the whole Mac quiet.
  [ "$slots" -ge 4 ] || slots=4
  export MI_PERF_LOCK_HELD=1 MI_E2E_LOCK_HELD=1 MI_E2E_UNITS_HELD="$slots" MI_PERF_SLOTS_HELD="$slots"
  slot=$((slots - 1))
  set -- sh "$0" "$@"
  while [ "$slot" -ge 0 ]; do
    set -- lockf -k "${E2E_LOCK:-/tmp/minor-incident-e2e.lock}.$slot" "$@"
    slot=$((slot - 1))
  done
  exec "$@"
fi
while :; do
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
    exec "$@"
  fi
  sleep 20
done
