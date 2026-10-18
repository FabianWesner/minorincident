#!/usr/bin/env python3
"""Compare every quality/zoom row for a 60-authored-scene Mac sample against a full remote catalog."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('mac')
parser.add_argument('remote')
parser.add_argument('--out', required=True)
args = parser.parse_args()
mac = json.loads(Path(args.mac).read_text())
remote = json.loads(Path(args.remote).read_text())
names = sorted({row['name'].split('@')[0] for row in mac['rows']})
if len(names) != 60:
    parser.error(f'expected 60 authored sample scenes, got {len(names)}')
remote_rows = {row['name']: row for row in remote['rows']}
missing, differences = [], []
for row in mac['rows']:
    other = remote_rows.get(row['name'])
    if other is None:
        missing.append(row['name'])
    elif row['pass'] != other['pass']:
        differences.append({'name': row['name'], 'macPass': row['pass'], 'remotePass': other['pass'],
                            'macFailed': row.get('failed'), 'remoteFailed': other.get('failed'),
                            'remoteError': other.get('error')})
result = {'sampleScenes': names, 'sampleRows': len(mac['rows']), 'remoteRows': len(remote['rows']),
          'macSeconds': mac['seconds'], 'remoteSeconds': remote['seconds'],
          'missing': missing, 'differences': differences, 'pass': not missing and not differences}
output = Path(args.out)
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, indent=2) + '\n')
print(f"60 scenes / {len(mac['rows'])} quality-zoom rows: {len(missing)} missing, {len(differences)} pass/fail differences; remote {remote['seconds']:.1f}s")
raise SystemExit(0 if result['pass'] else 1)
