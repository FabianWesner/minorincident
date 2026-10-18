#!/bin/sh
marker=$1
shift
printf x > "$marker"
export MI_PERF_LOCK_HELD=1 MI_E2E_LOCK_HELD=1 MI_E2E_UNITS_HELD=4 MI_PERF_SLOTS_HELD=4
exec python3 /Users/wesner/Workspace/minorincident/.claude/worktrees/merge-batch10/docs/reports/merge-batch10/evidence/bounded-run.py 1200 /bin/sh "$@"
