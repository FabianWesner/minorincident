#!/bin/sh
set -eu
level=$1 backend=$2 quality=$3
started=$(date +%s)
if [ ! -f test-results/load-stalls/quick-candidate-passed ]; then
  for check_backend in webgl2 webgpu; do
    for check_quality in high low; do
      LOAD_OUT=docs/reports/load-stalls/evidence/diagnostic-pose LOAD_TRACE=0 LOAD_GAMEPLAY_MS=0 npx tsx tools/perf/cold-load-time.ts http://127.0.0.1:4222 "$check_backend" "$check_quality" 3 L10
    done
  done
  python3 - <<'PY'
import json
from pathlib import Path
for path in Path('docs/reports/load-stalls/evidence/diagnostic-pose').glob('*-summary.json'):
    data = json.loads(path.read_text())
    assert data['n'] == 3 and data['max'] <= 6000 and not data['errors'], (path, data)
PY
  sh docs/reports/load-stalls/evidence/smoke.sh > /tmp/load-stalls-smoke-pose.log 2>&1
  cp test-results/load-stalls/playwright-results.json docs/reports/load-stalls/evidence/smoke-final.json
  sh docs/reports/load-stalls/evidence/l10-replay.sh > /tmp/load-stalls-l10-pose.log 2>&1
  python3 - <<'PY'
import gzip, json
from pathlib import Path
root = Path('docs/reports/load-stalls/evidence')
replay = root / 'l10-entry'
summary = {}
for path in replay.glob('*.json'):
    data = json.loads(path.read_text())
    summary[path.stem] = {key: data[key] for key in ['cardClosed', 'playableFrames', 'max', 'p95', 'hitches', 'backend', 'load']}
    with gzip.open(str(path) + '.gz', 'wb') as output: output.write(path.read_bytes())
    path.unlink()
for path in replay.glob('*.cpuprofile'):
    with gzip.open(str(path) + '.gz', 'wb') as output: output.write(path.read_bytes())
    path.unlink()
(replay / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
(replay / 'build.json').write_text((root / 'candidate-build.json').read_text())
(root / 'smoke-final-build.json').write_text((root / 'candidate-build.json').read_text())
for label, source in [('smoke-final', '/tmp/load-stalls-smoke-pose.log'), ('l10-final', '/tmp/load-stalls-l10-pose.log')]:
    with gzip.open(root / (label + '.log.gz'), 'wb') as output: output.write(Path(source).read_bytes())
PY
  touch test-results/load-stalls/quick-candidate-passed
  date +%s > test-results/load-stalls/candidate-proof-finished
fi
started=$(date +%s)
export LOAD_TRACE=0
export LOAD_BASELINE=docs/reports/load-stalls/evidence/before
if [ ! -f "$LOAD_BASELINE/$level-$backend-$quality-summary.json" ]; then
  LOAD_OUT="$LOAD_BASELINE" LOAD_GAMEPLAY_MS=0 npx tsx tools/perf/cold-load-time.ts http://127.0.0.1:4221 "$backend" "$quality" 20 "$level"
fi
# Leave enough reservation time for the cold observations and movement segment.
if [ "$(($(date +%s) - started))" -gt 600 ]; then exit 85; fi
LOAD_OUT=docs/reports/load-stalls/evidence/after LOAD_GAMEPLAY_MS=10000 LOAD_GAMEPLAY_LAST=1 LOAD_ASSERT=1 npx tsx tools/perf/cold-load-time.ts http://127.0.0.1:4222 "$backend" "$quality" 20 "$level"
