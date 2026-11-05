"""Read-only measurements of the lane's saved physical-input observations."""
import json
from pathlib import Path
import sys

run = Path(sys.argv[1])
threat = next(p for p in run.glob('*-threat.json') if 'l3l4' not in p.name)
samples = json.loads(threat.read_text())['samples']
entries = [json.loads(line) for line in next(run.glob('log-*.jsonl')).read_text().splitlines()]
observations = [e['observation'] for e in entries if 'observation' in e]


def gaps(rows, present):
    if len(rows) < 2:
        return None
    ticks = [rows[0]['tick']] + [r['tick'] for r in rows if present(r)] + [rows[-1]['tick']]
    interval = max(b['tick'] - a['tick'] for a, b in zip(rows, rows[1:])) / 60
    return {'observations': len(rows), 'positive': sum(present(r) for r in rows),
            'maximumSamplingSeconds': interval,
            'conservativeGapSeconds': max(b - a for a, b in zip(ticks, ticks[1:])) / 60 + interval}


result = {'run': str(run), 'level': samples[0]['level']}
if result['level'] == 'L9':
    driving = [r for r in observations if r.get('driving')]
    result['physicalDrivingLog'] = gaps(driving, lambda r: any(e['drawn'] and e['hp'] > 0 for e in r['enemies']))
    result['denseObserver'] = gaps([r for r in samples if r.get('step') == 'approach'], lambda r: bool(r['visibleInfected']))
elif result['level'] == 'L10':
    regions = json.loads(Path('layouts/D-CURE/routes.json').read_text())['regions']
    ledger = json.loads(next(run.glob('*-acceptance-ledger.json')).read_text())
    attacks = [e for l in ledger for e in l['events'] if e.get('type') == 'regional-attack-start' and e['target'] == 1]
    result['regions'] = []
    for region in regions:
        low, high = region['envelope']
        inside = lambda p: low[0] <= p['x'] < high[0] and low[1] <= p['z'] < high[1]
        rows = [s for s in samples if inside(s['player'])]
        if not rows:
            continue
        starts = [e for e in attacks if inside(e['player'])]
        minutes = (rows[-1]['tick'] - rows[0]['tick']) / 3600
        result['regions'].append({'region': region['id'], 'firstTick': rows[0]['tick'], 'lastTick': rows[-1]['tick'],
                                  'observedMinutes': minutes, 'playerAttackStarts': len(starts),
                                  'attacksPerMinute': len(starts) / minutes if minutes else None,
                                  'visibility': gaps(rows, lambda r: bool(r['visibleInfected']))})
    result['heightRange'] = [min(s['player']['y'] for s in samples), max(s['player']['y'] for s in samples)]
    result['fixtures'] = [e for e in entries if e.get('fixture', '').startswith('l10-')]
print(json.dumps(result, indent=2))
