"""Runner-only: keep SwiftShader contexts in fresh Playwright processes; unchanged test limits."""
import json
import pathlib
import re
import shutil
import subprocess

out = pathlib.Path('test-results/alpha-s2')
out.mkdir(parents=True, exist_ok=True)
cases = [f'T-E07-06-{move}-{width}' for width in (1280, 390, 844) for move in ('charge', 'ground-slam')]
cases += ['T-E07-physical-budget-high', 'T-E07-physical-budget-low']
results = []
for case in cases:
    run = subprocess.run(['npx', 'playwright', 'test', 'tests/e2e/alpha-physical.spec.ts', '--project=chromium', '--workers=1', '--grep', re.escape(case) + r'(?=\s)'])
    proof = json.loads(pathlib.Path('test-results/playwright/results.json').read_text())
    shutil.copyfile('test-results/playwright/results.json', out / f'{case}.json')
    results.append({'case': case, 'exit': run.returncode, 'stats': proof['stats']})
    (out / 'browser-cases.json').write_text(json.dumps(results, indent=2) + '\n')
raise SystemExit(0 if all(r['exit'] == 0 and r['stats']['expected'] == 1 and r['stats']['unexpected'] == 0 for r in results) else 1)
