"""Sequential native-only lane checks, dispatched through tools/remote/run.sh."""
import argparse
import json
import os
from pathlib import Path
import socket
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('--revision', required=True)
parser.add_argument('--compare-without-vignettes', action='store_true')
args = parser.parse_args()
if os.environ.get('MI_REMOTE') != '1':
    raise SystemExit('Dispatch this check with tools/remote/run.sh; no local heavy jobs.')

# Runner syncs deliberately have an index without history. Give provenance and
# review-freshness checks a real snapshot of exactly the files being validated.
subprocess.run(['git', 'add', '-A'], check=True)
subprocess.run(['git', '-c', 'user.name=Lane validation', '-c',
                'user.email=validation@example.invalid', 'commit', '--allow-empty',
                '-qm', f'Remote validation snapshot of {args.revision}'], check=True)
snapshot = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
root = Path('docs/reports/eg-l10-vignettes')
logs = Path('test-results/eg-l10-vignettes-checks' + ('-final' if args.compare_without_vignettes else ''))
logs.mkdir(parents=True, exist_ok=True)
root.mkdir(parents=True, exist_ok=True)
env = dict(os.environ, QA_ACCEPT_ROOT=str(root / 'acceptance'))
checks = [
    ('typecheck', ['npm', 'run', 'typecheck']),
    ('lint', ['npm', 'run', 'lint']),
    ('unit', ['npm', 'test', '--', '--maxWorkers=1']),
    ('scope', ['node', '--import', 'tsx/esm', 'tools/qa/l10-vignettes.ts']),
    ('baseline', ['python3', 'tools/qa/l10-vignettes-baseline.py', '--revision', args.revision]) if args.compare_without_vignettes else
    ('acceptance', ['npm', 'run', 'qa:accept', '--', '--level', 'L10', '--skip-browser']),
]
report = {'sourceCommit': args.revision, 'runnerSnapshotHead': snapshot,
          'host': socket.gethostname(), 'browsersLaunched': 0, 'checks': []}
for name, command in checks:
    print(f'[l10-vignettes] {name}: starting', flush=True)
    started = time.monotonic()
    with (logs / f'{name}.log').open('w') as log:
        result = subprocess.run(command, env=env, stdout=log, stderr=subprocess.STDOUT)
    row = {'name': name, 'command': command, 'exitCode': result.returncode,
           'seconds': round(time.monotonic() - started, 2), 'log': str(logs / f'{name}.log')}
    report['checks'].append(row)
    (root / ('final-checks.json' if args.compare_without_vignettes else 'native-checks.json')).write_text(json.dumps(report, indent=2) + '\n')
    print(f'[l10-vignettes] {name}: exit {result.returncode} ({row["seconds"]}s)', flush=True)
raise SystemExit(int(any(row['exitCode'] for row in report['checks'])))
