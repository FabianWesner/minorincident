"""L4 reception census under the current explicit high40/low30 criterion."""
from pathlib import Path
import gzip
import hashlib
import json
import math

sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
rows = []
def qualifies(facts, target):
    return facts['count'] >= target and facts['separation'] >= .7 - 1e-6 and not (
        facts['infected'] or facts['decals'] or facts['combat'] or facts['engaged']) and facts['calm']
for tier in ['low', 'high']:
    for zoom in [.5, 1.5]:
        file = Path(f'docs/reports/sweep-b/L4-{tier}-z{zoom}-ledger.json.gz')
        ledger = json.loads(gzip.decompress(file.read_bytes()))
        record = next(r for r in ledger if r['level'] == 'L4')
        # The source criterion's phase is quartermaster. The convoy ride precedes
        # the reception census; no hardcoded historical tick cutoff is used.
        samples = [s for s in record['l4Calm'] if s['phase'] == 'plaza']
        assert samples
        target = 30 if tier == 'low' else 40
        minimum = min(len(s['civilians']) for s in samples)
        nearest = min((math.hypot(a['x'] - b['x'], a['z'] - b['z']), s['tick'], a['id'], b['id'])
                      for s in samples for i, a in enumerate(s['civilians']) for b in s['civilians'][i+1:])
        infected = max(s['infected'] for s in samples)
        damage_decals = max(s['vfx']['decals'] for s in samples)
        combat = record['steps']['quartermaster']['playerWindups'] + record['steps']['quartermaster']['groupWindups']
        engaged = any(p.get('engaged') for s in samples for p in s['soldiers'])
        routines = sorted({p['routine'] for s in samples for p in s['civilians']})
        calm = all(p['state'] == 'calm' and p.get('activity') for s in samples for p in s['civilians'])
        facts = {'count': minimum, 'separation': nearest[0], 'infected': infected, 'decals': damage_decals,
                 'combat': combat, 'engaged': engaged, 'calm': bool(calm)}
        passed = qualifies(facts, target)
        assert passed
        # Explicit unchanged boundaries reject the corresponding wrong fact.
        controls = {key: not qualifies({**facts, key: value}, target) for key, value in
                    [('count', target - 1), ('separation', .69), ('infected', 1), ('decals', 1), ('combat', 1), ('engaged', True)]}
        assert all(controls.values())
        rows.append({'tier': tier, 'zoom': zoom, 'samples': len(samples), 'firstTick': samples[0]['tick'], 'lastTick': samples[-1]['tick'],
                     'minimumCivilians': minimum, 'requiredCivilians': target, 'minimumCentreSeparationM': nearest[0], 'closestPair': nearest[1:],
                     'infected': infected, 'combatWindups': combat, 'damageDecals': damage_decals, 'anyEngagedSoldier': engaged,
                     'routines': routines, 'allCivilianActivitiesCalm': bool(calm), 'status': 'PASS', 'controlsRejectWrongFact': controls,
                     'input': str(file), 'inputSha256': sha(file)})
out = Path('docs/reports/sweep-b/L4-02-proof.json')
out.write_text(json.dumps({'criteria': 'docs/qa/level-acceptance.md', 'criteriaSha256': sha('docs/qa/level-acceptance.md'),
    'producerSha256': sha(__file__), 'method': 'Actual2Hz pre-pickup reception samples; civilians exclude soldiers. Default human radii0.35m each give the0.7m non-overlap check. Named routines/activities and nonengagement are observed; relaxed poses and absence of clumps are inspected in the linked151-frame review. Current explicit low30/high40 targets preserved; the older low40 checker is not reused.', 'rows': rows}, indent=2) + '\n')
for row in rows:
    tier, zoom = row['tier'], row['zoom']
    file = Path(f'docs/reports/fix51-verify/receipts/L4-{tier}-webgl2-z{zoom}-browser.json')
    receipt = json.loads(file.read_text())
    receipt['checks'] = [c for c in receipt['checks'] if c['id'] != 'L4-02']
    receipt['checks'].append({'id': 'L4-02', 'clause': 'pre-pickup reception census routines separation and reviewed calm visuals',
        'tier': tier, 'policy': 'real-input-webgl2', 'status': row['status'], 'value': row,
        'target': 'high≥40/low≥30 civilians; no infected/combat/damage decals; calm routines, relaxed soldiers, no overlap or outside-camp clump', 'receipt': str(out)})
    file.write_text(json.dumps(receipt, indent=2) + '\n')
print([(r['tier'], r['zoom'], r['minimumCivilians'], r['minimumCentreSeparationM']) for r in rows])
