"""Bind one acceptance-row decision to its current measured inputs."""
import hashlib
import json
import sys
from pathlib import Path

row_id, note = sys.argv[1:3]
level = 'global' if row_id.startswith('G-') else row_id.split('-')[0]
report = json.loads(Path(f'docs/reports/fix51-verify/{level}.json').read_text())
row = next(row for row in report['rows'] if row['id'] == row_id)
paths = sorted({check['receipt'] for check in row['checks']} | set(sys.argv[3:]))
result = {'row': row_id, 'sourceHash': report['sourceHash'], 'observerHash': report['observerHash'],
          'currentStatus': row['currentStatus'], 'overallStatus': row['status'],
          'criterion': row['expected'], 'checks': row['checks'], 'observed': note,
          'remaining': row['remaining'], 'evidence': [
              {'file': path, 'sha256': hashlib.sha256(Path(path).read_bytes()).hexdigest(),
               'what': 'Source-bound measurement; exact clause, policy and coverage limits are recorded above.'}
              for path in paths]}
out = Path('docs/reports/fix55-c/rows'); out.mkdir(parents=True, exist_ok=True)
(out / f'{row_id}.json').write_text(json.dumps(result, indent=2)+'\n')
print(row_id, result['currentStatus'], len(result['checks']), 'measured clauses')
