#!/bin/sh
[ "$#" -gt 0 ] || set -- npm run build
marker=$(mktemp)
trap 'rm -f "$marker"' EXIT
while :; do
  : > "$marker"
  lockf -s -k -t 0 /tmp/minor-incident-e2e.lock.0 lockf -s -k -t 0 /tmp/minor-incident-e2e.lock.1 lockf -s -k -t 0 /tmp/minor-incident-e2e.lock.2 lockf -s -k -t 0 /tmp/minor-incident-e2e.lock.3 /bin/sh -c 'printf x > "$1"; shift; exec "$@"' sh "$marker" "$@"
  run_rc=$?
  if [ -s "$marker" ] || [ "$run_rc" -ne 75 ]; then exit "$run_rc"; fi
  sleep 2
done
