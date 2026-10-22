#!/bin/sh
set -u
if [ "${MI_AC_BROWSER_HELD:-}" = 1 ]; then exec /bin/sh "$@"; fi
case "$1" in
  tools/e2e-lock.sh|tools/perf/quiet-run.sh)
    case " $* " in
      *playwright*)
        if [ "$(date +%s)" -lt 1792660500 ]; then printf '%s\n' '[ac-close fence] native browser held until 2026-10-22 09:15 UTC' >&2; fi
        while [ "$(date +%s)" -lt 1792660500 ]; do sleep 20; done
        export MI_AC_BROWSER_HELD=1
        exec /usr/bin/lockf -k /tmp/ac-close-l4-l6-browser.serial /bin/sh /tmp/ac-close-l4-l6-verifier/launch.sh "$@";;
    esac;;
  tools/remote/run.sh)
    case " $* " in
      *'npx playwright test'*)
        export MI_AC_BROWSER_HELD=1
        exec /usr/bin/lockf -k /tmp/ac-close-l4-l6-browser.serial /bin/sh /tmp/ac-close-l4-l6-verifier/launch.sh "$@";;
    esac;;
esac
exec /bin/sh "$@"
