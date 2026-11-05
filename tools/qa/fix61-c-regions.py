"""Join physical route receipts on saved mission time, preserving Resume gaps.
Usage: python3 tools/qa/fix61-c-regions.py <run-directory> [<next-run-directory> ...]
No simulation writes or changed acceptance thresholds.
"""
import hashlib
import json
from pathlib import Path
import sys

runs = [Path(p) for p in sys.argv[1:]]
assert runs, 'At least one completed bounded physical run is required'
regions = json.loads(Path('layouts/D-CURE/routes.json').read_text())['regions']
samples, attacks, evidence, identities = [], {}, [], []
for run in runs:
    receipt = json.loads((run / 'receipt.json').read_text())
    assert receipt['error'] is None, receipt['error']
    assert receipt['result'] and all(not r['skipped'] for r in receipt['result']['runs'])
    identities.append((receipt['sourceHash'], receipt['tier'], receipt['backend']))
    threat_path = next(p for p in run.glob('*-threat.json') if 'l3l4' not in p.name)
    threat = json.loads(threat_path.read_text())['samples']
    assert threat and all(r['level'] == 'L10' for r in threat)
    offset = threat[0]['seconds'] - threat[0]['tick'] / 60
    ledger_path = next(run.glob('*-acceptance-ledger.json'))
    for ledger in json.loads(ledger_path.read_text()):
        for event in ledger['events']:
            if event.get('type') == 'regional-attack-start' and event['target'] == 1:
                seconds = offset + event['tick'] / 60
                attacks[(round(seconds, 6), event['source'])] = {**event, 'seconds': seconds}
    samples.extend(threat)
    for p in [run / 'receipt.json', threat_path, ledger_path]:
        evidence.append({'file': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()})
assert len(set(identities)) == 1, 'Do not join sources, tiers or backends'
samples.sort(key=lambda s: s['seconds'])
rows = []
for index, region in enumerate(regions):
    low, high = region['envelope']
    def inside(p):
        return low[0] <= p['x'] < high[0] and low[1] <= p['z'] < high[1]
    observed = [s for s in samples if inside(s['player']) and s['step'] not in ('hold', 'mega', 'release', 'epilogue', 'credits')]
    if len(observed) < 2:
        continue
    first, last = observed[0], observed[-1]
    minutes = (last['seconds'] - first['seconds']) / 60
    events = [e for e in attacks.values() if first['seconds'] <= e['seconds'] <= last['seconds'] and inside(e['player'])]
    target = 2 if index < 2 else 4
    rows.append({'region': region['id'], 'firstMissionSeconds': first['seconds'], 'lastMissionSeconds': last['seconds'],
                 'firstPlayer': first['player'], 'lastPlayer': last['player'], 'observations': len(observed),
                 'minutes': minutes, 'playerAttackStarts': len(events), 'attacksPerMinute': len(events) / minutes,
                 'targetPerMinute': target, 'measuredRatePass': len(events) / minutes >= target,
                 'minimumAliveObserved': min(s['aliveInfected'] for s in observed)})
print(json.dumps({'sourceHash': identities[0][0], 'tier': identities[0][1], 'backend': identities[0][2],
                  'method': 'Read-only physical player-targeted attack events / full observed geographic mission-time span. Resume offsets retained; no group substitution or removal of quiet intervals. Partial regions are not full-row qualification. Courier protection is disclosed in the raw receipts.',
                  'runs': [str(r) for r in runs], 'regions': rows, 'evidence': evidence}, indent=2))
