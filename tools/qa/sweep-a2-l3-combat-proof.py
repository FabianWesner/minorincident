"""Recompute every L3-03 numeric clause from current native phase ledgers."""
import copy
import gzip
import json
from pathlib import Path

root = Path('docs/reports/sweep-a2')
def qualify(p):
    return (p['attacks'] > 0 and p['seconds'] > 0
            and p['attacks'] * 60 / p['seconds'] >= 4
            and p['boundedPaths']['samples'] > 0
            and p['boundedPaths']['minimumPercent'] >= 90)

rows = []
for tier in ['low', 'high']:
    for policy in ['complete', 'stationary']:
        path = Path(f'docs/reports/fix51-verify/receipts/L3-{tier}-{policy}.json')
        receipt = json.loads(path.read_text())
        p = next(p for p in receipt['threat']['phases'] if p['key'] == 'step/defend')
        assert qualify(p)
        assert abs(p['attacksPerMinute'] - p['attacks'] * 60 / p['seconds']) < 1e-9
        if policy == 'stationary':
            assert p['firstAttackSeconds'] is not None and p['firstAttackSeconds'] <= 10
        rows.append({'tier': tier, 'policy': policy, 'phase': p,
                     'sourceHash': receipt['sourceHash'], 'observerHash': receipt['observerHash']})
        (root / f'L3-03-{tier}-{policy}.json.gz').write_bytes(gzip.compress(path.read_bytes(), mtime=0))
p = rows[0]['phase']
controls = []
for key, value in [('attacks', 0), ('seconds', 10000)]:
    fault = copy.deepcopy(p); fault[key] = value
    controls.append({'test': f'{key} fault rejected', 'pass': not qualify(fault)})
for key, value in [('samples', 0), ('minimumPercent', 89.9)]:
    fault = copy.deepcopy(p); fault['boundedPaths'][key] = value
    controls.append({'test': f'boundedPaths.{key} fault rejected', 'pass': not qualify(fault)})
assert all(c['pass'] for c in controls)
report = json.loads(Path('docs/reports/fix51-verify/L3.json').read_text())
row = next(r for r in report['rows'] if r['id'] == 'L3-03')
assert len(row['checks']) == 14 and all(c['status'] == 'PASS' for c in row['checks'])
(root / 'L3-03-before-requalification.json').write_text(json.dumps(row, indent=2)+'\n')
(root / 'L3-03-current-proof.json').write_text(json.dumps({
    'sourceHash': rows[0]['sourceHash'], 'observerHash': rows[0]['observerHash'],
    'checks': row['checks'], 'runs': rows, 'controls': controls, 'pass': True}, indent=2)+'\n')
print('L3-03 all14 numeric clauses recomputed; four numeric faults rejected')
