#!/bin/sh
set -u
# The already-running remote phone/eye trial predates this serial fence.
while ps -p 18604 -o command= | /opt/homebrew/bin/rg -q 'tools/remote/run.sh.*test-results/ac-close/readability'; do sleep 10; done
printf '[ac-close fence] admitted at %s: %s\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC')" "$*" >&2
exec /bin/sh "$@"
