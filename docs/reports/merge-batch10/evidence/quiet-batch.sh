#!/bin/sh
export MI_BATCH_QUEUED_AT=$(date +%s)
exec lockf -k -t 1800 /tmp/minor-incident-merge-batch10-native.queue /bin/sh /Users/wesner/Workspace/minorincident/.claude/worktrees/merge-batch10/docs/reports/merge-batch10/evidence/quiet-admit.sh "$@"
