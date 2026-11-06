"""Publish the measured L6 second-breach clause into current acceptance receipts."""
from pathlib import Path
import hashlib
import json
import subprocess

sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
proof = Path('docs/reports/sweep-b/L6-04-proof.json')
data = json.loads(proof.read_text())
browser_hash = subprocess.check_output(['node', '--import', 'tsx', '-e',
    "import {browserHash} from './tools/qa/accept/browser.ts'; process.stdout.write(browserHash());"], text=True)
for row in data['rows']:
    assert row['status'] == 'PASS'
    tier = row['tier']
    control = json.loads(Path(f'docs/reports/fix51-verify/receipts/L6-{tier}-complete.json').read_text())
    assert control['sourceHash'] == data['sourceHash']
    path = Path(f'docs/reports/fix51-verify/receipts/L6-{tier}-webgl2-z1.5-browser.json')
    receipt = json.loads(path.read_text()) if path.exists() else {
        'version': 1, 'level': 'L6', 'tier': tier, 'sourceHash': data['sourceHash'],
        'fixtureHash': sha(__file__), 'browserHash': browser_hash, 'errors': [], 'checks': [],
        'observations': {'scope': 'Current-source supplementary native clauses and185 reviewed physical images. Four physical routes remain unfinished; no full-route G-25 PASS.',
                         'captureReview': 'docs/reports/sweep-b/L6-capture-review.json', 'captureReviewSha256': sha('docs/reports/sweep-b/L6-capture-review.json')},
    }
    receipt['checks'] = [c for c in receipt['checks'] if c['id'] != 'L6-04']
    receipt['checks'].append({'id': 'L6-04', 'clause': 'actual second breach arrivals power and abandon condition',
        'tier': tier, 'policy': 'controlled-fixture', 'status': 'PASS', 'value': row,
        'target': 'breach2 after20–30s; two accesses and at least10 actual arrivals; power off within one tick with red emergency light; abandon at15s or three bitten', 'receipt': str(proof)})
    path.write_text(json.dumps(receipt, indent=2) + '\n')
criterion = next(r['expected'] for r in json.loads(Path('docs/reports/fix51-verify/L6.json').read_text())['rows'] if r['id'] == 'L6-04')
note = 'Both tiers: second breach21.0167s after first, ten actual same-ID bodies from accesses0/1 reach shelter floor; main power off and red emergency group active on actual breach tick3253 and next tick. Abandon4147 is14.9s later with three bitten/lost roster members, satisfying the explicit alternative. Independent80s ordinary controls retain identical world hashes. Physical frames show main-light fall and red emergency fixtures; unfinished browser routes are not promoted to completion.'
review = {'row': 'L6-04', 'status': 'PASS', 'reviewer': 'Codex/sweep-b', 'date': '2026-11-06',
    'commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip(),
    'clauses': [{'clause': criterion, 'verdict': 'PASS', 'note': note}],
    'evidence': [{'file': f, 'sha256': sha(f), 'what': note} for f in [str(proof), 'docs/reports/sweep-b/L6-capture-review.json']]}
Path('docs/qa/reviews/L6-04.json').write_text(json.dumps(review, indent=2) + '\n')
print('L6-04 current both-tier event/floor/power/abandon proof PASS')
