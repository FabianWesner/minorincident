#!/bin/bash
# Runs ON the runner, inside the synced workspace: take a slot, make sure node_modules matches package-lock.json, run the command.
# Called by tools/remote/run.sh. RUNNER_SLOTS (default 2) commands run at once, the rest queue FIFO-ish (polling).
set -u
[ "${1:-}" = "--" ] && shift
export PATH=/usr/local/bin:$PATH
SLOTS="${RUNNER_SLOTS:-2}"
mkdir -p /srv/mi/locks /srv/mi/queue /srv/mi/nm
QF="/srv/mi/queue/$$.job"
date +%s > /srv/mi/last-activity
printf '%s\t%s\t%s\n' "${MI_SLUG:-?}" "$(date +%s)" "$*" > "$QF"
trap 'rm -f "$QF"; date +%s > /srv/mi/last-activity' EXIT
# 1. slot (flock on one of N files, kept open on fd 9 for the whole run)
got=""
while [ -z "$got" ]; do
  i=0
  while [ "$i" -lt "$SLOTS" ]; do
    exec 9>"/srv/mi/locks/slot.$i"
    if flock -n 9; then got=$i; break; fi
    i=$((i + 1))
  done
  [ -z "$got" ] && sleep 2
done
printf '%s\t%s\t%s\t%s\n' "${MI_SLUG:-?}" "$(date +%s)" "slot$got" "$*" > "$QF.run"; mv "$QF.run" "$QF"
echo "[runner] slot $got acquired; load $(cut -d' ' -f1-3 /proc/loadavg)"
# 2. node_modules cache keyed by package-lock hash (hardlink copy, so changes to a workspace never touch the cache)
H=$(sha256sum package-lock.json package.json | sha256sum | cut -c1-16)
if [ ! -f "/srv/mi/nm/$H/.ok" ]; then
  exec 8>"/srv/mi/locks/nm.$H"; flock 8
  if [ ! -f "/srv/mi/nm/$H/.ok" ]; then
    echo "[runner] npm ci (lockfile hash $H)"
    rm -rf "/srv/mi/nm/$H"; mkdir -p "/srv/mi/nm/$H"
    cp package.json package-lock.json "/srv/mi/nm/$H/"
    (cd "/srv/mi/nm/$H" && npm ci --no-audit --no-fund --loglevel=error && npx playwright install chromium >/dev/null; sudo -n env PATH=$PATH npx playwright install-deps chromium >/dev/null 2>&1 || true; touch .ok) || { echo "[runner] npm ci failed" >&2; rm -rf "/srv/mi/nm/$H"; exit 70; }
  fi
  flock -u 8
fi
if [ "$(cat .mi-nmhash 2>/dev/null)" != "$H" ] || [ ! -d node_modules ]; then
  rm -rf node_modules && cp -al "/srv/mi/nm/$H/node_modules" node_modules && echo "$H" > .mi-nmhash
fi
# 3. run
eval "for e in $MI_ENVS; do export \"\$e\"; done"
export MI_REMOTE=1 CI=1
cd . && "$@"
