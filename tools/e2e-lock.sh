#!/bin/sh
# Machine-wide browser capacity. One unit = one live browser / Scene Lab session.
# Two units (10-18): three or more GPU browsers starved WindowServer (watchdog kill, user session lost on 10-16, 10-17, 10-18).
# Playwright commands charge their worker count (default 2); other commands default to 1.
# For an opaque wrapper, declare E2E_UNITS=1 or 2 explicitly. All lanes must agree on E2E_SLOTS.
root=$(cd "$(dirname "$0")/.." && pwd)
if [ "${E2E_LEGACY:-0}" != 1 ]; then
  # An opaque command already admitted by the pool owns the external reservation.
  [ "${MI_BROWSER_POOL_EXTERNAL:-}" != 1 ] || exec "$@"
  exec node --import tsx "$root/tools/browser-pool/wrapper.ts" shared "$@"
fi
export BROWSER_POOL=off
slots="${E2E_SLOTS:-2}"
if ! command -v lockf >/dev/null 2>&1; then
  [ "${MI_E2E_JOB_HELD:-}" != 1 ] || exec "$@"
  fallback_seconds="${E2E_RESERVATION_SECONDS:-600}"
  case "$fallback_seconds" in ''|*[!0-9]*|0) echo 'E2E_RESERVATION_SECONDS must be a positive integer' >&2; exit 2;; esac
  [ "$fallback_seconds" -le 600 ] || { echo 'Browser reservations are capped at 10 minutes; split the batch.' >&2; exit 2; }
  exec python3 "$root/tools/browser-job.py" --seconds "$fallback_seconds" -- "$@"
fi
if [ "${MI_E2E_JOB_HELD:-}" != 1 ]; then
  export MI_E2E_JOB_HELD=1
  exec python3 "$root/tools/browser-job.py" -- sh "$0" "$@"
fi
admission_seconds="${E2E_ADMISSION_TIMEOUT_SECONDS:-1800}"
case "$admission_seconds" in ''|*[!0-9]*|0) printf '%s\n' 'E2E_ADMISSION_TIMEOUT_SECONDS must be a positive integer' >&2; exit 2;; esac
deadline=$(($(date +%s) + admission_seconds))
case "$slots" in ''|*[!0-9]*|0) printf '%s\n' 'E2E_SLOTS must be a positive integer' >&2; exit 2;; esac
[ "$(uname -s)" != Darwin ] || [ "$slots" -le 2 ] || slots=2
workers=''; playwright=0; next_workers=0
for arg in "$@"; do
  if [ "$next_workers" -eq 1 ]; then workers="$arg"; next_workers=0; fi
  case "$arg" in
    playwright|*/playwright|*/playwright/cli.js|*/@playwright/test/cli.js) playwright=1;;
    --workers) next_workers=1;;
    --workers=*) workers="${arg#--workers=}";;
  esac
done
[ "$next_workers" -eq 0 ] || { printf '%s\n' 'Missing --workers value' >&2; exit 2; }
if [ "$playwright" -eq 1 ]; then
  workers="${workers:-2}"
  case "$workers" in 1|2) ;; *) printf '%s\n' 'Playwright is limited to 1 or 2 workers on this machine' >&2; exit 2;; esac
fi
units="${E2E_UNITS:-${workers:-1}}"
case "$units" in 1|2) ;; *) printf '%s\n' 'E2E_UNITS must be 1 or 2 (use quiet-run for an exclusive run)' >&2; exit 2;; esac
[ "$units" -le "$slots" ] || { printf '%s\n' 'Requested browsers exceed E2E_SLOTS' >&2; exit 2; }
if [ "$playwright" -eq 1 ] && [ "$units" -lt "$workers" ]; then
  printf '%s\n' 'E2E_UNITS must cover every Playwright worker' >&2; exit 2
fi
# Re-entrant wrappers cannot expand a reservation acquired by their parent.
if [ -n "${MI_E2E_LOCK_HELD:-}" ]; then
  if [ -n "${MI_E2E_UNITS_HELD:-}" ] && [ "$units" -gt "$MI_E2E_UNITS_HELD" ]; then
    printf '%s\n' 'Outer browser reservation is too small; request its full capacity at the outer wrapper' >&2; exit 2
  fi
  exec "$@"
fi
export MI_E2E_LOCK_HELD=1 MI_E2E_UNITS_HELD="$units"
reservation_seconds="${E2E_RESERVATION_SECONDS:-600}"
case "$reservation_seconds" in ''|*[!0-9]*|0) printf '%s\n' 'E2E_RESERVATION_SECONDS must be a positive integer' >&2; exit 2;; esac
[ "$reservation_seconds" -le 600 ] || { echo 'Browser reservations are capped at 10 minutes; split the batch.' >&2; exit 2; }
run_seconds=$((reservation_seconds - 5)); [ "$run_seconds" -gt 0 ] || run_seconds=1
set -- python3 "$root/tools/browser-job.py" --seconds "$run_seconds" -- "$@"
export MI_WAIT_KIND=browser MI_WAIT_STARTED="$(node -p 'Date.now()')"
base="${E2E_LOCK:-/tmp/minor-incident-e2e.lock}"
# The command may itself return 75. Record admission so that it is never mistaken for
# lockf's busy status and executed again. Keep command stderr; -s silences only lockf.
started=$(mktemp "${TMPDIR:-/tmp}/minor-incident-e2e-start.XXXXXX") || exit 1
trap 'rm -f "$started"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
attempt() {
  : > "$started"
  "$@"; rc=$?
  if [ -s "$started" ] || [ "$rc" -ne 75 ]; then exit "$rc"; fi
}
while :; do
  [ "$(date +%s)" -lt "$deadline" ] || { echo "Browser admission exceeded ${admission_seconds} seconds; report unmeasured coverage." >&2; exit 75; }
  # Sample before acquiring slots so waiting for host recovery does not reserve GPU capacity.
  if ! python3 "$root/tools/mac-gpu-guard.py" "$units"; then sleep 2; continue; fi
  i=0
  while [ "$i" -lt "$slots" ]; do
    if [ "$units" -eq 1 ]; then
      attempt lockf -s -k -t 0 "$base.$i" sh -c 'printf x > "$1"; shift; exec "$@"' sh "$started" "$@"
    else
      j=$((i + 1))
      while [ "$j" -lt "$slots" ]; do
        # Both acquisitions are nonblocking and ordered; a partial reservation releases
        # immediately. Consider every pair, including nonadjacent free slots.
        attempt lockf -s -k -t 0 "$base.$i" lockf -s -k -t 0 "$base.$j" sh -c 'printf x > "$1"; shift; exec "$@"' sh "$started" "$@"
        j=$((j + 1))
      done
    fi
    i=$((i + 1))
  done
  sleep 2
done
