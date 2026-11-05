"""Archive and measure the current-source real-input L5 corgi matrix.

Capture inspection is separate: this script never marks an image reviewed or
removes it. Failed/unfinished driver runs remain in the report.
"""
from pathlib import Path
import collections
import gzip
import hashlib
import json
import math
import subprocess
import sys

label = sys.argv[1] if len(sys.argv) > 1 else 'sweep-b-l5-c'
root = Path('test-results/vqa-fix-5-matrix') / label
matrix = json.loads((root / 'results.json').read_text())
identity = json.loads(subprocess.check_output([
    'node', '--import', 'tsx', '-e',
    "import {provenance} from './tools/qa/accept/probe.ts'; process.stdout.write(JSON.stringify(provenance()));"
], text=True))
assert matrix['source']['sourceHash'] == identity['sourceHash']
expected = {(backend, tier, zoom) for backend in ['webgpu', 'webgl2']
            for tier in ['low', 'high'] for zoom in [.5, 1.5]}
assert {(c['backend'], c['tier'], c['zoom']) for c in matrix['cells']} == expected
out = Path('docs/reports/sweep-b/corgi')
out.mkdir(parents=True, exist_ok=True)
sha = lambda data: hashlib.sha256(data).hexdigest()
rows = []
for cell in sorted(matrix['cells'], key=lambda c: c['tag']):
    assert cell['exit'] == 0 and cell['sourceHash'] == identity['sourceHash']
    run_dir = Path('test-results/vqa-1b') / cell['tag']
    trace_path = run_dir / f"{cell['tag']}-companion-trace.json"
    trace = json.loads(trace_path.read_text())
    run = json.loads((run_dir / f"runs-{cell['tag']}.json").read_text())[0]
    issues = json.loads((run_dir / f"issues-{cell['tag']}.json").read_text())
    assert trace and not any(t['paused'] for t in trace)
    opening = [t for t in trace if t['tick'] <= 180 * 60]
    assert opening and max(t['tick'] for t in trace) >= 180 * 60
    assert not any(i['kind'] in ['console-error', 'page-error'] for i in issues)
    within = sum(t['distance'] <= 6 for t in trace)
    opening_within = sum(t['distance'] <= 6 for t in opening)
    continuous = longest = 0
    recoveries = []
    for t in trace:
        continuous = continuous + 1 if t['distance'] > 10 else 0
        longest = max(longest, continuous)
    for a, b in zip(trace, trace[1:]):
        if a['corgi']['state'] == 'hide' and b['corgi']['state'] != 'hide':
            recoveries.append({'fromTick': a['tick'], 'toTick': b['tick'],
                               'displacementM': math.hypot(b['corgi']['x'] - a['corgi']['x'], b['corgi']['z'] - a['corgi']['z'])})
    archive = out / f"{cell['tag']}-companion-trace.json.gz"
    archive.write_bytes(gzip.compress(trace_path.read_bytes(), mtime=0))
    rows.append({**cell, 'samples': len(trace), 'within6mSamples': within,
                 'within6mShare': within / len(trace), 'first180SecondsSamples': len(opening),
                 'first180SecondsWithin6mSamples': opening_within,
                 'first180SecondsWithin6mShare': opening_within / len(opening),
                 'maximumSeparationM': max(t['distance'] for t in trace),
                 'longestAbove10mS': longest * .5, 'recoveries': recoveries,
                 'finished': run['finished'], 'skipped': run['skipped'],
                 'issues': issues, 'trace': str(archive), 'traceSha256': sha(archive.read_bytes()),
                 'missingRootSamples': sum(not t['render']['present'] for t in trace),
                 'outsideHideInvisibleSamples': sum(t['corgi']['state'] != 'hide' and not t['corgi']['hidden'] and not t['render'].get('visible') for t in trace),
                 'hideHudMismatches': sum(t['corgi']['state'] == 'hide' and 'hiding' not in (t['hud'] or '').lower() for t in trace)})

native = json.loads((out / 'native-routes.json').read_text())
assert native['sourceHash'] == identity['sourceHash']
controls = []
for result in native['results']:
    receipt = Path(f"docs/reports/fix51-verify/receipts/L5-{result['tier']}-complete.json")
    control = json.loads(receipt.read_text())
    assert control['sourceHash'] == identity['sourceHash']
    assert control['nativeStateHash'] == result['nativeStateHash'], 'observer must preserve canonical final state'
    controls.append({'tier': result['tier'], 'nativeStateHash': result['nativeStateHash'],
                     'receipt': str(receipt), 'receiptSha256': sha(receipt.read_bytes())})

proximity_pass = all(r['within6mShare'] >= .95 and r['first180SecondsWithin6mShare'] >= .95 for r in rows)
completed_tiers = {r['tier'] for r in rows if r['finished'] and not r['skipped']}
summary = {**identity, 'method': 'Physical WASD/mouse authored rescue tour; seed1 progressed saves; protected courier, mortal followers; no frame timing. The unchanged E08-AC04 proximity bound is checked over the fixed first180sim seconds and the whole observed route. Driver failures remain explicit.',
           'tool': str(Path(__file__)), 'toolSha256': sha(Path(__file__).read_bytes()),
           'matrix': str(root / 'results.json'), 'matrixSha256': sha((root / 'results.json').read_bytes()),
           'proximityStatus': 'PASS' if proximity_pass else 'FAIL',
           'fullPhysicalRouteCompletedAtBothTiers': completed_tiers == {'low', 'high'},
           'canonicalNativeControls': controls, 'cells': rows,
           'captureReview': 'PENDING: inspect every raw capture and retain per-image SHA-256 and observations before P1 closure.'}
(out / 'physical-matrix.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps({'proximityStatus': summary['proximityStatus'], 'completedCells': sum(r['finished'] for r in rows),
                  'cells': len(rows), 'maximumSeparationM': max(r['maximumSeparationM'] for r in rows),
                  'driverIssues': dict(collections.Counter(i['kind'] for r in rows for i in r['issues']))}))
assert proximity_pass and completed_tiers == {'low', 'high'}
