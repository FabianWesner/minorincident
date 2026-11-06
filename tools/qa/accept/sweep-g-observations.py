"""Archive read-only route and checkpoint observations; this does not assign acceptance PASS."""
from pathlib import Path
import gzip
import hashlib
import json
import math
import re
import sys

root = Path('docs/reports/sweep-g')
source = json.loads((root / 'build-final.json').read_text())['sourceHash']
row = sys.argv[1]
rows = []

def write(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n')

def archive(path, value):
    path.write_bytes(gzip.compress(json.dumps(value).encode(), mtime=0))
    return {'file': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}

if row == 'G-21':
    for path in sorted(Path('docs/reports/fix51-verify/receipts').glob('L*-checkpoints.json')):
        data = json.loads(path.read_text())
        if data['sourceHash'] != source:
            continue
        proof = archive(root / ('G-21-' + path.name + '.gz'), data)
        rows.append({'level': data['level'], 'tier': data['tier'], 'control': data['control'],
                     'errors': data['errors'], 'evidence': proof,
                     'cases': [{'clause': c['clause'], 'status': c['status'], 'value': c['value']}
                               for c in data['checks'] if c['id'] == row]})
    write(root / 'G-21-checkpoints.json', {'sourceHash': source, 'status': 'NOT CHECKED',
          'method': 'Naturally reached checkpoint saves, fresh native worlds, dirty gates/racks/pickups/follower HP, actual mortal death/respawn; independent route control state hashes.',
          'contractConflict': ['Global wording requires snapshot rewind everywhere.',
              'E19 PO amendment 2026-10-07 preserves the live L1 world; E22-AC17 preserves L4 war/collapse world. Existing probes explicitly exercise these exceptions.',
              'Specs and acceptance wording unchanged. No false game failure assigned to an explicit authored exception; global wording needs reconciliation.'],
          'rows': rows})
elif row in ('G-08', 'G-14'):
    for receipt in sorted(root.glob('G-25-*webgl2.json')):
        if 'audited' not in receipt.name and 'final-L6' not in receipt.name:
            continue
        data = json.loads(receipt.read_text())
        if data['sourceHash'] != source:
            continue
        folder = Path('test-results/sweep-g') / receipt.stem
        if row == 'G-08':
            for log in folder.rglob('log-accept.jsonl'):
                observations = [x['observation'] for line in log.read_text().splitlines()
                                if (x := json.loads(line)).get('observation')]
                points = {}
                compared = []
                for observation in observations:
                    marker, player = observation.get('marker'), observation.get('player')
                    if not marker or not player:
                        continue
                    points.setdefault(str(observation.get('step')), set()).add((round(marker['x'], 3), round(marker['z'], 3)))
                    match = re.search(r'(\d+)\s*m(?:\b|$)', observation.get('text', ''))
                    if match:
                        direct = math.hypot(marker['x'] - player['x'], marker['z'] - player['z'])
                        compared.append({'tick': observation['tick'], 'step': observation.get('step'), 'text': observation['text'],
                                         'shownM': int(match[1]), 'directM': direct,
                                         'roundingErrorM': abs(int(match[1]) - math.floor(direct + .5)), 'marker': marker, 'player': player})
                batch = '-' + log.parent.name if log.parent.name.startswith('batch') else ''
                proof = archive(root / ('G-08-' + receipt.stem + batch + '-observations.json.gz'), observations)
                rows.append({'route': receipt.stem, 'batch': batch, 'evidence': proof,
                             'stepMarkerPoints': {step: sorted(values) for step, values in points.items()},
                             'distanceSamples': len(compared), 'mismatchesBeyond1M': [c for c in compared if c['roundingErrorM'] > 1]})
        else:
            for ledger in folder.rglob('accept-acceptance-ledger.json'):
                life = [{key: d.get(key, []) for key in ['level', 'corpseLife', 'corpseSamples']} for d in json.loads(ledger.read_text())]
                bodies = [body for level in life for body in level['corpseLife']]
                batch = '-' + ledger.parent.name if ledger.parent.name.startswith('batch') else ''
                proof = archive(root / ('G-14-' + receipt.stem + batch + '-lifetimes.json.gz'), life)
                rows.append({'route': receipt.stem, 'batch': batch, 'evidence': proof, 'tracked': len(bodies),
                             'sleeping': sum(b['sleepingSamples'] > 0 for b in bodies),
                             'missingBodies': [b for b in bodies if b['missingSamples'] > 0]})
    write(root / (row + '-route-observations.json'), {'sourceHash': source, 'status': 'NOT CHECKED',
          'method': 'Read-only physical route observations. Sampled marker coordinates require comparison with authored action points; handoffs and UI/world update boundaries are not automatically failures. Corpse lifetimes include sleeping chunks; checkpoint restores/revivals and separate Resume batches end an observation interval.',
          'rows': rows})
else:
    raise ValueError(row)
print(row, len(rows), 'current-source evidence rows')
