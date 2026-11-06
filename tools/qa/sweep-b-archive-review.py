"""Archive hashes and explicit sheet observations, then remove reviewed raw captures."""
from pathlib import Path
import gzip
import hashlib
import json
import sys

root, output = map(Path, sys.argv[1:3])
seen = json.loads((root / 'reviewed-sheets.json').read_text())
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
records, archives, metadata = [], [], []
for manifest in sorted((root / 'review').glob('*-manifest.json')):
    for rec in json.loads(manifest.read_text()):
        if 'sheet' not in rec:
            assert sha(rec['archive']) == rec['archiveSha256']
            archives.append(rec)
            continue
        source, sheet = Path(rec['source']), Path(rec['sheet'])
        observation = seen[sheet.stem]
        assert observation['observation'].strip()
        assert sha(source) == rec['sha256'] and sha(sheet) == observation['sha256']
        records.append({**rec, 'sheetSha256': observation['sha256'], 'observation': observation['observation']})
        meta = source.with_suffix('.json')
        if meta.exists():
            metadata.append({'file': str(meta), 'sha256': sha(meta), 'content': json.loads(meta.read_text())})
archive = root / 'evidence' / 'capture-metadata.json.gz'
archive.write_bytes(gzip.compress(json.dumps(metadata).encode(), mtime=0))
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({'reviewer': 'Codex/sweep-b', 'date': '2026-11-06',
    'images': len(records), 'sheets': len(seen), 'records': records, 'archives': archives,
    'captureMetadataArchive': str(archive), 'captureMetadataSha256': sha(archive),
    'cleanup': 'Raw JPEGs and capture metadata deleted after inspection and digest verification. Numbered sheets remain in ignored test-results.'}, indent=2) + '\n')
for rec in records:
    p = Path(rec['source'])
    p.unlink()
    p.with_suffix('.json').unlink(missing_ok=True)
print(len(records), 'reviewed captures archived and deleted')
