#!/bin/sh
# Reserve both browser slots: a second lane must not start midway through a timing run.
# Use this instead of an outer e2e-lock wrapper for native performance measurements.
if [ "${MI_PERF_LOCK_HELD:-}" != 1 ]; then
  export MI_PERF_LOCK_HELD=1 MI_E2E_LOCK_HELD=1
  exec lockf -k "${E2E_LOCK:-/tmp/minor-incident-e2e.lock}.0" lockf -k "${E2E_LOCK:-/tmp/minor-incident-e2e.lock}.1" sh "$0" "$@"
fi
while :; do
  # pgrep's own command is excluded by pgrep. Also catch native Chrome's --headless flag.
  if ! pgrep -fl 'chrome.*headless' >/dev/null && node -e 'process.exit(require("node:os").loadavg()[0] < 3 ? 0 : 1)'; then
    uptime
    if [ -n "${PERF_CONDITIONS_LOG:-}" ]; then
      node -e 'const fs=require("node:fs"),os=require("node:os");fs.appendFileSync(process.env.PERF_CONDITIONS_LOG,JSON.stringify({at:new Date().toISOString(),load:os.loadavg(),otherHeadlessChrome:0,browserSlots:[0,1],command:process.argv.slice(1)})+"\n")' "$@"
    fi
    printf '%s\n' 'Quiet-run preflight: load < 3; pgrep -fl chrome.*headless: no processes; browser slots .0/.1 held.'
    exec "$@"
  fi
  sleep 20
done
