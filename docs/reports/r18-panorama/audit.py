"""Audit the requested matrix against the current source and retained render receipts."""
import gzip
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
sha = lambda b: hashlib.sha256(b).hexdigest()
rows = []
for tier in ['low', 'high']:
    for backend in ['webgl2', 'webgpu']:
        for aspect in ['landscape', 'portrait']:
            r = json.loads(gzip.open(root / f'{tier}-{backend}-{aspect}.json.gz').read())
            assert r['finished'] and not r['errors'], (r['tag'], r['errors'])
            assert not r['sourceDiff'], r['tag']
            assert r['producerSha256'] == sha((root / 'capture.ts').read_bytes()), r['tag']
            for path, digest in r['sourceFiles'].items():
                assert sha(Path(path).read_bytes()) == digest, (r['tag'], path)
            assert r['seedSha256'] == sha((root / 'seeds' / f'L10-{tier}-release.json.gz').read_bytes())
            g = r['geometry']
            assert g['pass'] and r['frames']['frames'] > 0
            assert g['maxDraws'] <= (300 if tier == 'low' else 600)
            assert g['maxTriangles'] <= (500000 if tier == 'low' else 1500000)
            assert all(r['frames']['phases'][phase]['frames'] > 0 for phase in ['playable', 'title', 'credits', 'thanks'])
            shots = {c['label']: c for c in r['captures']}
            assert len(shots['pre-release']['state']['hud']) >= 2, r['tag']
            for seconds in [50, 55, 60, 65]:
                s = shots[f'ending-{seconds}s']['state']
                assert seconds * 60 <= s['elapsed'] < (seconds + 1) * 60, (r['tag'], seconds, s['elapsed'])
            final = shots['ending-65s']['state']
            assert final['overview']['visible'] and final['overview']['mistInstances'] == 8
            assert final['overview']['woodlandInstances'] > 0 and final['overview']['groundSize']['width'] == 100000
            assert final['camera']['fov'] == 60
            assert all(abs(c[0]) <= .99 and abs(c[1]) <= .99 and 0 < c[2] < 1 for c in final['corners']), (r['tag'], final['corners'])
            for c in r['captures']:
                s = c['state']
                assert s['backend'] == backend and s['quality'] == tier
                if backend == 'webgl2': assert 'WebGL 2' in s['glVersion']
                if aspect == 'portrait': assert s['touch']
                if c['label'] != 'pre-release': assert not s['hud'] and not s['worldBars'] and s['cinematicUi'], (r['tag'], c['label'])
                assert s['draws'] <= g['maxDraws'] and s['triangles'] <= g['maxTriangles']
                assert sha(Path(c['file']).read_bytes()) == c['sha256']
            rows.append({'tag': r['tag'], 'frames': r['frames']['frames'], 'captures': len(r['captures']), **g})
sheet = json.loads((root / 'sheet.json').read_text())
assert len(sheet['cells']) == 16 and sha((root / sheet['sheet']).read_bytes()) == sheet['sha256']
checks = json.loads((root / 'E32-checks.json').read_text())
assert all(c['status'] == 0 for c in checks['checks'])
result = {'pass': True, 'matrixCases': len(rows), 'frames': sum(r['frames'] for r in rows), 'captures': sum(r['captures'] for r in rows), 'rows': rows}
(root / 'audit.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result))
