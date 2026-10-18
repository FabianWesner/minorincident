#!/bin/sh
error_file=$(mktemp)
/usr/bin/pgrep "$@" 2> "$error_file"
run_rc=$?
if [ -s "$error_file" ] || [ "$run_rc" -gt 1 ] || ! /usr/bin/id -un >/dev/null 2>&1; then
  cat "$error_file" >&2
  printf '%s\n' "$PPID" > /Users/wesner/Workspace/minorincident/.claude/worktrees/merge-batch10/test-results/merge-batch10/quiet-unhealthy-parent.pid
  rm -f "$error_file"
  exit 0
fi
rm -f "$error_file"
exit "$run_rc"
