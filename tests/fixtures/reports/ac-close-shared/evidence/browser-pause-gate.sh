#!/bin/sh
case "$1" in
  tools/e2e-lock.sh|tools/perf/quiet-run.sh)
    while [ "$(date +%s)" -lt 1792628788 ] || [ ! -f /tmp/ac-close-shared-browser-gate/released ]; do
      /bin/sleep 1
    done
    ;;
esac
exec /bin/sh "$@"
