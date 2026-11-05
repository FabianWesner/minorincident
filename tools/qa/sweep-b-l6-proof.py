"""Evaluate the retained every-tick native L6 trajectory ledger."""
from pathlib import Path
import hashlib
import json

file = Path('docs/reports/sweep-b/L6-trajectories.json')
data = json.loads(file.read_text())
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
layout_file = 'public/assets/layouts/D-SUBWAY.layout.json'
layout = json.loads(Path(layout_file).read_text())
floors = [s for s in layout['surfaces'] if s['surface'] in ('tile', 'gravel')]
def on_floor(p):
    return any(min(v[0] for v in s['polygon']) <= p['x'] <= max(v[0] for v in s['polygon'])
               and min(v[1] for v in s['polygon']) <= p['z'] <= max(v[1] for v in s['polygon'])
               for s in floors)
results = []
for row in data['rows']:
    actors = row['actors']
    sides = [a for a in actors if a['wave'] == 4]
    counts = {str(d): sum(a['door'] == d for a in sides) for d in sorted({a['door'] for a in sides})}
    births = [{'id': a['id'], 'wave': a['wave'], 'birth': a['birth'], 'onWalkableFloor': on_floor(a['birth']), 'pathAtBirth': a['pathAtBirth']} for a in actors]
    results.append({'tier': row['tier'], 'canonicalHash': row['canonicalHash'],
                    'observedHash': row['observedHash'], 'events': row['events'], 'power': row['power'],
                    'allAdmissionBirths': births, 'allBirthsOnFloor': all(a['onWalkableFloor'] for a in births),
                    'allBirthPaths': all(a['pathAtBirth'] for a in births),
                    'sideEntryCounts': counts, 'sideEntryExactTwo': len(counts) == 6 and all(n == 2 for n in counts.values()),
                    'sideBodiesReachTracks': all(a['firstTrack'] is not None for a in sides),
                    'sidePathSamples': sum(a['pathSamples'] for a in sides),
                    'sidePathFailures': sum(a['pathFailures'] for a in sides)})
out = Path('docs/reports/sweep-b/L6-trajectory-proof.json')
out.write_text(json.dumps({
    'sourceHash': data['sourceHash'], 'revision': data['revision'],
    'ledger': str(file), 'ledgerSha256': sha(file),
    'observer': 'tools/qa/accept/fix53-l6-trajectories.ts', 'observerSha256': sha('tools/qa/accept/fix53-l6-trajectories.ts'),
    'layout': layout_file, 'layoutSha256': sha(layout_file),
    'method': 'Actual admission identities followed every tick; native final state must equal canonical control. Birth centres checked in XZ against authored floor polygons; raised rail supports make nominal surface height insufficient for a birth-height verdict. Strict same-body track arrivals remain in the original ledger. Bounded paths measured at birth and2Hz. No actor/input/RNG mutation. This is not a pixel/lighting verdict.',
    'results': results,
}, indent=2) + '\n')
for r in results:
    print(r['tier'], 'birth floor', r['allBirthsOnFloor'], 'side counts', r['sideEntryCounts'])
