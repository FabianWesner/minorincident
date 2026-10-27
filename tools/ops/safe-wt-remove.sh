#!/bin/sh
# Remove a lane worktree only when it has no tracked changes outside capture output (lesson 10-23).
#   sh tools/ops/safe-wt-remove.sh <worktree-path>
set -eu
wt=${1:?usage: safe-wt-remove.sh <worktree-path>}
[ -d "$wt" ] || { echo "no such worktree: $wt" >&2; exit 64; }
dirty=$(git -C "$wt" status --porcelain --untracked-files=no | grep -v -E '^.. (test-results/|docs/reports/.*\.(png|jpg|webm|webp)$)' || true)
if [ -n "$dirty" ]; then
  echo "refusing: tracked changes in $wt" >&2
  echo "$dirty" | head -20 >&2
  exit 1
fi
git worktree remove --force "$wt"
git worktree prune
echo "removed $wt"
