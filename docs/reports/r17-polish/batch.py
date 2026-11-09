"""Run the visual matrix serially, with a separate <=600s pooled lease per command."""
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
import time

root = Path('docs/reports/r17-polish')
logs = Path('/private/tmp/r17-polish/logs')
logs.mkdir(parents=True, exist_ok=True)
rows = []
env = {**os.environ, 'SCENE_PORT': '4351', 'SCENE_SERVER': 'preview',
       'E2E_SERIAL': '1', 'E2E_UNITS': '1', 'E2E_RESERVATION_SECONDS': '600',
       'BROWSER_POOL_JOB_ID': 'r17-polish', 'QA_BOUND_SECONDS': '180',
       'QA_MAX_DEATHS': '3', 'QA_SEED': '1'}
env.pop('QA_OPEN_ONLY', None)
modes = sys.argv[1:] or ['apc', 'truck', 'crash', 'L5', 'L7']
for mode in modes:
    for tier in ['low', 'high']:
        for backend in ['webgl2', 'webgpu']:
            args = ['route.ts', mode, tier, backend, 'complete'] if mode in ['L5', 'L7'] else [mode + '.ts', tier, backend]
            cmd = ['sh', 'tools/e2e-lock.sh', 'node', '--import', 'tsx', str(root / args[0]), *args[1:]]
            tag = f'{mode}-{tier}-{backend}'
            started = time.time()
            print('START', tag, flush=True)
            with (logs / (tag + '.log')).open('w') as log:
                result = subprocess.run(cmd, env=env, stdout=log, stderr=subprocess.STDOUT, timeout=630)
            rows.append({'tag': tag, 'command': cmd, 'status': result.returncode,
                         'seconds': round(time.time() - started, 3),
                         'startedAt': datetime.datetime.fromtimestamp(started, datetime.timezone.utc).isoformat()})
            (root / 'matrix.json').write_text(json.dumps(rows, indent=2) + '\n')
            print('END', tag, result.returncode, rows[-1]['seconds'], flush=True)
            if result.returncode:
                print((logs / (tag + '.log')).read_text()[-4000:], flush=True)
                sys.exit(result.returncode)
