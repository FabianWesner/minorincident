#!/usr/bin/env python3
"""Retain the successful gate identity, measured counts and raw output."""
import gzip
import json
import re
from pathlib import Path

source = Path('test-results/r17-l7escort-verify-final')
out = Path('docs/reports/r17-l7escort/evidence')
identity = json.loads((source / 'identity.json').read_text())
gate = json.loads((source / 'checks.json').read_text())
raw = (source / 'verify.log').read_bytes()
log = re.sub(r'\x1b\[[0-9;]*m', '', raw.decode())
assert all(check['status'] == 0 for check in gate['checks'])
line = re.search(r'^\s*Tests\s+(.+)$', log, re.MULTILINE).group(1)
count = lambda label: int(match.group(1)) if (match := re.search(r'(\d+) ' + label, line)) else 0
collection = re.search(r'\[test-budget\] (\d+)/(\d+) test cases.*?, (\d+)/(\d+) files', log)
budget = re.search(r'\[test-budget\] test: ([\d.]+) s \(budget (\d+) s\)', log)
result = {**identity, 'runnerSnapshotRevision': identity['revision'], 'target': gate['target'],
    'checks': gate['checks'], 'passed': count('passed'), 'skipped': count('skipped'), 'failed': count('failed'),
    'collectionCases': int(collection.group(1)), 'collectionFiles': int(collection.group(3)),
    'testWallSeconds': float(budget.group(1)), 'testBudgetSeconds': int(budget.group(2)),
    'testTimeoutMilliseconds': 30000, 'testUnitAlias': 'npm test', 'browsersUsed': False}
assert result['failed'] == 0 and result['passed'] > 0
assert result['testWallSeconds'] <= result['testBudgetSeconds'] == 240
assert 1 <= result['maxWorkers'] <= 4
(out / 'verification.json').write_text(json.dumps(result, indent=2) + '\n')
(out / 'verify-log.gz').write_bytes(gzip.compress(raw, mtime=0))
print(json.dumps(result, indent=2))
