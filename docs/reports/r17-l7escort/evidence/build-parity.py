#!/usr/bin/env python3
"""Compare every other level's complete native/passive threat receipt."""
import json
from pathlib import Path

before = json.loads(Path('test-results/r17-l7escort-main-other/audit.json').read_text())
after = json.loads(Path('test-results/r17-l7escort-final-other/audit.json').read_text())
rows = []
for baseline in before['levels']:
    final = next(row for row in after['levels'] if row['level'] == baseline['level'])
    clean_before = {k: v for k, v in baseline.items() if k != 'wallSeconds'}
    clean_after = {k: v for k, v in final.items() if k != 'wallSeconds'}
    phases = []
    for policy, field in [('skilled', 'observation'), ('passive', 'passiveObservation')]:
        for old in baseline[field]['phases']:
            new = next(row for row in final[field]['phases'] if row['key'] == old['key'])
            phases.append({'policy': policy, 'phase': old['key'], 'seconds': [old['seconds'], new['seconds']],
                'courierAPM': [old['attacksPerMinute'], new['attacksPerMinute']], 'groupAPM': [old['groupAttacksPerMinute'], new['groupAttacksPerMinute']]})
    rows.append({'level': baseline['level'], 'entireReceiptEqualExceptWallSeconds': clean_before == clean_after,
        'nativeStateHash': [baseline['nativeStateHash'], final['nativeStateHash']], 'phaseRows': phases,
        'flags': [baseline['flags'], final['flags']], 'passiveFlags': [baseline['passiveFlags'], final['passiveFlags']]})
result = {'baselineSourceHash': before['sourceHash'], 'finalSourceHash': after['sourceHash'],
    'observerHashes': [before['observerHash'], after['observerHash']], 'levelCount': len(rows),
    'stageCounts': [len(json.loads(Path(f'test-results/r17-l7escort-{tag}-other/stages.json').read_text())) for tag in ['main', 'final']],
    'phaseCount': sum(len(row['phaseRows']) for row in rows), 'flagsEqual': before['flags'] == after['flags'],
    'flags': after['flags'], 'comparisonExcludes': ['level.wallSeconds'], 'levels': rows}
Path('docs/reports/r17-l7escort/evidence/other-levels-parity.json').write_text(json.dumps(result, indent=2) + '\n')
assert len(rows) == 9
assert all(row['entireReceiptEqualExceptWallSeconds'] for row in rows)
assert result['flagsEqual']
assert result['observerHashes'][0] == result['observerHashes'][1]
print(f"All {len(rows)} levels and {result['phaseCount']} primary phase rows match exactly, excluding level.wallSeconds.")
