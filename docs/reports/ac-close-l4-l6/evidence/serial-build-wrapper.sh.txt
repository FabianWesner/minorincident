#!/bin/sh
set -u
if [ "${MI_AC_BROWSER_HELD:-}" != 1 ] && [ "${1:-}" = run ] && [ "${2:-}" = build ]; then
  export MI_AC_BROWSER_HELD=1
  exec /usr/bin/lockf -k /tmp/ac-close-l4-l6-browser.serial /opt/homebrew/bin/npm "$@"
fi
exec /opt/homebrew/bin/npm "$@"
