#!/bin/sh
# tools/remote/run.sh syncs an object-free Git index. The review freshness test needs
# a real source tree at HEAD, so give this disposable job an honest src/ + public/ snapshot.
# Never run against a developer's worktree refs.
set -eu
[ "${MI_REMOTE:-}" = 1 ] || { echo 'Use tools/remote/run.sh for this disposable QA snapshot.' >&2; exit 64; }
audit_index=$(mktemp /tmp/e25-index.XXXXXX)
rm -f "$audit_index"
trap 'rm -f "$audit_index"' EXIT
GIT_INDEX_FILE="$audit_index" git read-tree --empty
git ls-files -z -- src public | GIT_INDEX_FILE="$audit_index" git update-index --add -z --stdin
source_tree=$(GIT_INDEX_FILE="$audit_index" git write-tree)
source_commit=$(printf 'Disposable E25 source snapshot for review freshness validation\n' | git -c user.name='E25 QA' -c user.email='e25-qa@localhost' commit-tree "$source_tree")
git update-ref HEAD "$source_commit"
printf '[E25 QA] disposable source snapshot %s\n' "$source_commit"
result=0
npm run verify -- E25 || result=$?
cp test-results/epics/E25/checks.json test-results/epics/E25/runtimechecks.json
npm run build:qa || exit $?
exit "$result"
