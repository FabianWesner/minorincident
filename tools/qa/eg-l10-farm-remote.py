"""Sequential lane checks on a remote runner; preserve logs and a compact receipt."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time

if os.environ.get('MI_REMOTE') != '1' or not Path('.git').is_dir():
    raise SystemExit('Run via tools/remote/run.sh; this prepares only its disposable git snapshot.')

origin = os.environ['L10_FARM_SOURCE_REVISION']
# The runner normally has an index without commit objects. Acceptance and the review tests need HEAD.
Path('.git/index').unlink(missing_ok=True)
subprocess.run(['git', 'add', '-f', '--pathspec-from-file=.mi-manifest', '--pathspec-file-nul'], check=True)
subprocess.run(['git', '-c', 'user.name=Remote validation', '-c', 'user.email=runner@example.invalid',
                '-c', 'core.hooksPath=/dev/null', 'commit', '--allow-empty', '-qm', f'Validation snapshot of {origin}'], check=True)
snapshot = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
review_only = '--review-only' in sys.argv
root = Path('test-results/eg-l10-farm-review' if review_only else 'test-results/eg-l10-farm')
root.mkdir(parents=True, exist_ok=True)
env = {**os.environ, 'QA_ACCEPT_ROOT': 'docs/reports/eg-l10-farm/acceptance'}
checks = [
    ('typecheck', ['npm', 'run', 'typecheck']),
    ('lint', ['npm', 'run', 'lint']),
    ('unit', ['npm', 'test', '--', '--maxWorkers=1']),
    ('farm-native', ['node', '--import', 'tsx/esm', 'tools/qa/eg-l10-farm.ts']),
    ('acceptance', ['npm', 'run', 'qa:accept', '--', '--level', 'L10', '--skip-browser']),
]
if review_only:
    checks = [
        ('typecheck', ['npm', 'run', 'typecheck']),
        ('lint', ['npm', 'run', 'lint']),
        ('unit', ['npm', 'test', '--', '--maxWorkers=1']),
    ]
receipt = {'sourceRevision': origin, 'remoteSnapshot': snapshot, 'host': socket.gethostname(), 'checks': []}
for name, command in checks:
    print(f'[farm-check] {name}: starting', flush=True)
    started = time.monotonic()
    log = root / f'{name}.log'
    with log.open('w') as output:
        result = subprocess.run(command, env=env, stdout=output, stderr=subprocess.STDOUT)
    receipt['checks'].append({'name': name, 'command': command, 'exitCode': result.returncode,
                             'seconds': round(time.monotonic() - started, 2),
                             'outputTail': '\n'.join(log.read_text().splitlines()[-35:])})
    (root / 'checks.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(f'[farm-check] {name}: exit={result.returncode}; {receipt["checks"][-1]["seconds"]}s', flush=True)
raise SystemExit(int(any(row['exitCode'] for row in receipt['checks'])))
