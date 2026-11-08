#!/bin/sh
# CPU-only gate in the disposable remote workspace; never builds or opens browsers.
set -eu
[ "${MI_REMOTE:-}" = 1 ] || { echo 'Run via tools/remote/run.sh.' >&2; exit 64; }
audit_index=$(mktemp /tmp/r12-index.XXXXXX)
rm -f "$audit_index"
trap 'rm -f "$audit_index"' EXIT
GIT_INDEX_FILE="$audit_index" git read-tree --empty
git ls-files -z -- src public | GIT_INDEX_FILE="$audit_index" git update-index --add -z --stdin
source_tree=$(GIT_INDEX_FILE="$audit_index" git write-tree)
source_commit=$(printf 'Disposable R12 source snapshot\n' | git -c user.name='R12 QA' -c user.email='r12-qa@localhost' commit-tree "$source_tree")
git update-ref HEAD "$source_commit"
node --input-type=module <<'JS'
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const commands = [['run', 'typecheck'], ['run', 'lint'], ['test', '--', '--maxWorkers=1']];
const checks = commands.map(args => {
  const started = Date.now();
  const result = spawnSync('npm', args, { stdio: 'inherit' });
  return { command: ['npm', ...args].join(' '), status: result.status, seconds: (Date.now() - started) / 1000 };
});
mkdirSync('test-results/r12-shadow', { recursive: true });
writeFileSync('test-results/r12-shadow/cpu-checks.json', JSON.stringify({ checks, vitestWorkers: 1, browsers: 0, builds: 0 }, null, 2) + '\n');
process.exitCode = checks.every(check => check.status === 0) ? 0 : 1;
JS
