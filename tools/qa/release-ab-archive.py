"""Retain lossless raw browser receipts while making the checked-in JSON readable."""
import gzip
import hashlib
import json
from pathlib import Path

root = Path('test-results/release-ab-1101')
archives = []

def trim(value):
    if isinstance(value, list):
        return [trim(v) for v in value]
    if not isinstance(value, dict):
        return value
    result = {}
    for key, item in value.items():
        if key == 'inputs' and isinstance(item, list):
            result['inputFrameCount'] = len(item)
            result['inputFrameSamples'] = item[:2] + item[-2:]
        elif key == 'frames' and isinstance(item, list) and item and isinstance(item[0], (int, float)):
            result['rafFrameCount'] = len(item)
            result['rafFrameSamples'] = item[:2] + item[-2:]
        else:
            result[key] = trim(item)
    return result

for folder in ('strips', 'engagement', 'effects', 'scenes', 'handovers', 'weapons'):
    for path in sorted((root / folder).rglob('*.json')):
        archive = path.with_suffix('.full.json.gz')
        if archive.exists():
            raw = gzip.decompress(archive.read_bytes())
        elif path.stat().st_size > 300_000:
            raw = path.read_bytes()
            archive.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
        else:
            continue
        data = trim(json.loads(raw))
        for row in data if isinstance(data, list) else [data]:
            row['rawReceipt'] = str(archive.relative_to(root))
        path.write_text(json.dumps(data, indent=2) + '\n')
        archives.append({'receipt': str(path.relative_to(root)), 'raw': str(archive.relative_to(root)), 'rawBytes': len(raw), 'rawSha256': hashlib.sha256(raw).hexdigest()})
(root / 'raw-archives.json').write_text(json.dumps(archives, indent=2) + '\n')
print(f'{len(archives)} lossless raw archives retained; dense arrays summarized in readable receipts.')
