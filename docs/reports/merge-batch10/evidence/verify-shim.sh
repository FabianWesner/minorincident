#!/bin/sh
if [ "${MI_PERF_LOCK_HELD:-}" = 1 ]; then exec /bin/sh "$@"; fi
case "$1" in
  tools/perf/quiet-run.sh|*/tools/perf/quiet-run.sh)
    exec /bin/sh /Users/wesner/Workspace/minorincident/.claude/worktrees/merge-batch10/test-results/merge-batch10/qa-bin/quiet-batch.sh "$@" ;;
  *) exec /bin/sh "$@" ;;
esac
