#!/bin/sh
deadline=$((${MI_BATCH_QUEUED_AT:-$(date +%s)} + 1800))
marker=$(mktemp)
trap 'rm -f "$marker"' EXIT
while [ "$(date +%s)" -lt "$deadline" ]; do
  : > "$marker"
  lockf -s -k -t 0 /tmp/minor-incident-e2e.lock.0 lockf -s -k -t 0 /tmp/minor-incident-e2e.lock.1 lockf -s -k -t 0 /tmp/minor-incident-e2e.lock.2 lockf -s -k -t 0 /tmp/minor-incident-e2e.lock.3 /bin/sh /Users/wesner/Workspace/minorincident/.claude/worktrees/merge-batch10/docs/reports/merge-batch10/evidence/quiet-reserved.sh "$marker" "$@"
  run_rc=$?
  if [ -s "$marker" ] || [ "$run_rc" -ne 75 ]; then
    # All four browser locks have been released; allow an ordinary batch to enter.
    sleep 60
    exit "$run_rc"
  fi
  sleep 2
done
printf '%s\n' 'Quiet admission exceeded 30 minutes; this batch is unmeasured.' >&2
exit 124
