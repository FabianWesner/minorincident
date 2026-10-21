#!/bin/sh
# One bounded, serial native gate + matched frame capture batch. Build before admission.
set -u
[ "${MI_PERF_LOCK_HELD:-}" = 1 ] || { echo 'Use tools/perf/quiet-run.sh -> tools/e2e-lock.sh' >&2; exit 2; }
heap_out=${HEAP_FINAL_OUT:-docs/reports/heap-budgets/evidence/final}
heap_baseline=${HEAP_BASELINE_DIST:?Set HEAP_BASELINE_DIST to the preserved baseline build}
mkdir -p "$heap_out"
python3 - "$heap_out" "$heap_baseline" <<'PYRECEIPT'
from pathlib import Path
import datetime, hashlib, json, subprocess, sys
out=Path(sys.argv[1])
def hashes(root):
    return {str(p.relative_to(root)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.rglob('*')) if p.is_file()}
receipt={'started':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'head':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
    'source':hashes(Path('src')), 'perfTests':hashes(Path('tests/perf')),
    'candidateBuild':hashes(Path('dist/build')), 'baselineBuild':hashes(Path(sys.argv[2])/'build')}
(out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
(out/'source.patch').write_bytes(subprocess.check_output(['git','diff','93e1fbea8','--','src']))
PYRECEIPT
npx playwright test tests/perf/e25-light-lab.spec.ts tests/perf/e25-lighting.spec.ts tests/perf/weather.spec.ts tests/perf/l7-encounters.spec.ts tests/perf/l7-district.spec.ts tests/perf/l7-rocket.spec.ts tests/perf/l7-lifecycle.spec.ts tests/perf/l5-budgets.spec.ts --project=chromium --workers=1
heap_native_rc=$?
python3 - "$heap_out" "$heap_native_rc" <<'PY'
from pathlib import Path
import json, shutil, sys
out=Path(sys.argv[1]); native=int(sys.argv[2])
for epic, patterns in [('E25',['perf-*.*']),('E25/closure',['perf-*.*']),('E28/perf',['storm*.json']),('E23/perf',['l5-*.*','l4-pair-plaza-*.png']),('E29',['*-perf-*.json','lifecycle-*.json'])]:
    for pattern in patterns:
        for p in (Path('test-results/epics')/epic).glob(pattern):
            if p.suffix not in ['.png','.json']: continue
            dest=out/'perf'/epic/p.name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
shutil.copy2('test-results/playwright/results.json',out/'playwright.json')
(out/'native-exit.json').write_text(json.dumps({'exitCode':native},indent=2)+'\n')
PY
HEAP_AUDIT_DIST="$heap_baseline" HEAP_AUDIT_OUT="$heap_out/baseline-control" HEAP_AUDIT_SNAPSHOT=0 npx tsx tools/perf/heap-audit.ts
heap_control_rc=$?
HEAP_AUDIT_DIST="$PWD/dist" HEAP_AUDIT_OUT="$heap_out/candidate" HEAP_AUDIT_SNAPSHOT=0 npx tsx tools/perf/heap-audit.ts
heap_candidate_rc=$?
npx tsx tools/perf/heap-pixel-diff.ts "$heap_out/baseline-control" "$heap_out/candidate" "$heap_out/pixels"
heap_pixels_rc=$?
npx tsx tools/perf/heap-pixel-diff.ts docs/reports/heap-budgets/evidence/before "$heap_out/baseline-control" "$heap_out/baseline-repeat-pixels"
heap_repeat_rc=$?
python3 - "$heap_out" "$heap_native_rc" "$heap_control_rc" "$heap_candidate_rc" "$heap_pixels_rc" "$heap_repeat_rc" <<'PY'
from pathlib import Path
import json,sys
keys=['native','baselineControl','candidateCapture','candidatePixels','baselineRepeatPixels']
(Path(sys.argv[1])/'exit-codes.json').write_text(json.dumps(dict(zip(keys,map(int,sys.argv[2:]))),indent=2)+'\n')
PY
[ "$heap_native_rc" = 0 ] && [ "$heap_control_rc" = 0 ] && [ "$heap_candidate_rc" = 0 ] && [ "$heap_pixels_rc" = 0 ]
