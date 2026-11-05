"""Publish one explicitly decided native row, retaining source-bound clauses."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

row, status, note = sys.argv[1:4]
assert status in ('PASS', 'FAIL')
level = row.split('-')[0]
report = json.loads(Path(f'docs/reports/fix51-verify/{level}.json').read_text())
result = next(r for r in report['rows'] if r['id'] == row)
assert result['checks'] and result['currentStatus'] == status
if status == 'PASS':
    assert result['automatedComplete']
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
out = Path(f'docs/reports/sweep-b/rows/{row}.json')
out.parent.mkdir(parents=True, exist_ok=True)
receipts = sorted(set(c['receipt'] for c in result['checks']))
out.write_text(json.dumps({
    'row': row, 'status': status, 'revision': revision, 'sourceHash': report['sourceHash'],
    'criterion': result['expected'], 'criteriaSha256': sha('docs/qa/level-acceptance.md'),
    'observation': note, 'checks': result['checks'],
    'receipts': [{'file': p, 'sha256': sha(p)} for p in receipts],
}, indent=2) + '\n')
clauses = [{'clause': result['expected'], 'verdict': status, 'note': note}]
review = {'row': row, 'status': status, 'reviewer': 'Codex/sweep-b',
          'date': '2026-11-06', 'commit': revision, 'clauses': clauses,
          'evidence': [{'file': str(out), 'sha256': sha(out), 'what': note}],
          'notes': 'Current-source native measurements at both tiers. A FAIL closes the verdict through the cited counterexample; unmeasured clauses are not promoted to PASS.'}
Path(f'docs/qa/reviews/{row}.json').write_text(json.dumps(review, indent=2) + '\n')
print(row, status)
