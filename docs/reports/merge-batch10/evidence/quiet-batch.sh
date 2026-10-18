#!/bin/sh
queued_at=$(date +%s)
exec lockf -k -t 1800 /tmp/minor-incident-merge-batch10-native.queue /bin/sh -c '
  queued_at=$1
  shift
  remaining=$((1800 - $(date +%s) + queued_at))
  [ "$remaining" -gt 0 ] || exit 124
  [ "$remaining" -le 1200 ] || remaining=1200
  python3 /Users/wesner/Workspace/minorincident/.claude/worktrees/merge-batch10/docs/reports/merge-batch10/evidence/bounded-run.py "$remaining" /bin/sh "$@"
  run_rc=$?
  # The child released every browser lock. Leave a full minute for ordinary batches.
  sleep 60
  exit "$run_rc"
' sh "$queued_at" "$@"
