"""Check the requested capture matrix and final-source validation receipts."""
import gzip
import hashlib
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).parent
checks = []
build = json.loads((ROOT / 'build.json').read_text())
def read(tag):
    result = json.loads(gzip.open(ROOT / f'{tag}.json.gz').read())
    assert not result['errors'], (tag, result['errors'])
    assert not result['sourceDiff'], tag
    expected_revision = build['environmentRevision'] if result['mode'] in ['environment', 'barn'] else build['revision']
    assert result['revision'] == expected_revision, (tag, 'source revision')
    assert result['producerSha256'] == hashlib.sha256((ROOT / 'capture.ts').read_bytes()).hexdigest(), (tag, 'capture producer')
    assert result['geometry']['pass'], (tag, result['geometry'])
    for capture in result['captures']:
        raw = Path(capture['file'])
        if raw.exists(): assert hashlib.sha256(raw.read_bytes()).hexdigest() == capture['sha256'], raw
    expected = 'webgl' if result['backend'] == 'webgl2' else 'webgpu'
    assert all(c['state']['actualBackend'] == expected and c['state']['actualQuality'] == result['tier'] for c in result['captures']), tag
    return result

ending_rows = []
for tier in ['low', 'high']:
    for backend in ['webgl2', 'webgpu']:
        tag = f'environment-{tier}-{backend}-landscape'
        r = read(tag)
        assert not [w for w in r['warnings'] if 'PLACEHOLDER' in w], tag
        for label in ['farm-PO', 'farm-route-1350', 'farm-route-1650', 'farm-route-3150', 'farm-route-3450', 'barn-intact', 'barn-collapsed', 'hangar-interior', 'hangar-exterior', 'propane-tank']:
            assert {c['zoom'] for c in r['captures'] if c['label'] == label} == {1, 1.5}, (tag, label)
        for c in r['captures']:
            if c['label'] == 'barn-collapsed':
                assert c['state']['barn']['state']['collapsed']
                assert 'l10-barn-help-roof' not in c['state']['decals']
            if c['label'].startswith('farm-'):
                assert c['state']['nearbyCrops'], (tag, c['label'], 'no nearby crops')
            if c['label'] == 'propane-tank':
                assert abs(c['state']['position']['x'] - 858.66) < 3, (tag, 'propane fixture position')
                assert any(not p['exploded'] and abs(p['position']['x'] - 856.5) < .1 for p in c['state']['propane'])
            if c['label'].startswith('hangar-'):
                refs = [ref for batch in c['state']['roofBatches'] for ref in batch['refs'] if ref['id'] == 'D-CURE/l10-hangar-shell']
                assert len(refs) == 1 and refs[0]['hidden'] == (c['label'] == 'hangar-interior')
        graves = read(f'barn-{tier}-{backend}-landscape')
        assert len(graves['context']['graves']) == 3
        assert all(g['position'][0] > 948 for g in graves['context']['graves'])
        if backend == 'webgl2': assert 'WebGL 2' in graves['context']['webglVersion']
        checks.append({'matrix': f'{tier}/{backend}', 'environment': 'PASS', 'graves': 'PASS'})
        ending_rows.append(read(f'ending-{tier}-{backend}-landscape-carried'))
        ending_rows.append(read(f'ending-{tier}-{backend}-landscape'))
    ending_rows.append(read(f'ending-{tier}-webgl2-portrait-carried'))
    ending_rows.append(read(f'ending-{tier}-webgl2-portrait'))

for r in ending_rows:
    assert r['finished']
    assert r['renderFrames']['frames'] > 1000
    assert set(r['renderFrames']['phases']) >= {'playable', 'title', 'credits', 'thanks'}
    assert {c['label'] for c in r['captures']} >= {f'ending-{n}s' for n in range(0, 65, 5)} | {'title', 'credits', 'thanks'}
    assert all({c['zoom'] for c in r['captures'] if c['label'] == label} == {1, 1.5} for label in {c['label'] for c in r['captures']})
    checks.append({'matrix': r['tag'], 'renderFrames': r['renderFrames']['frames'], 'geometry': r['geometry'], 'ending': 'PASS'})
control = read('ending-low-webgl2-landscape-fast')
assert control['finished']
checks.append({'defaultCampaignClosingControl': 'PASS', 'method': 'accelerated appearance fixture'})

route = json.loads(gzip.open(ROOT / 'route-runner.json.gz').read())
paths = subprocess.check_output(['git', 'ls-files', 'src', 'layouts/D-CURE', 'tools/qa/l10-pacing.ts', 'public/assets/layouts/D-CURE.layout.json', 'public/assets/layouts/D-CURE.chunks/manifest.json']).decode().strip().split('\n')
base = build['routeRevision']
assert subprocess.check_output(['git', 'diff', '--name-only', base, build['revision'], '--', 'src']).decode().strip().split('\n') == ['src/render/LevelTenEndingView.ts']
assert subprocess.check_output(['git', 'diff', '--numstat', base, build['revision'], '--', 'src/render/LevelTenEndingView.ts']).decode().split()[:2] == ['5', '5']
assert subprocess.check_output(['git', 'diff', '--name-only', build['environmentRevision'], build['revision'], '--', 'src']).decode().strip() == 'src/render/LevelTenEndingView.ts'
assert subprocess.check_output(['git', 'diff', '--numstat', build['environmentRevision'], build['revision'], '--', 'src']).decode().split()[:2] == ['3', '3']
h = hashlib.sha256()
for path in sorted(paths): h.update(path.encode()); h.update(subprocess.check_output(['git', 'show', f'{base}:{path}']))
assert h.hexdigest() == route['sourceHash'], 'Runner receipt must match the gameplay source; only the ending tableau camera changed afterward'
assert {r['quality'] for r in route['results']} == {'low', 'high'}
assert all(r['outcome'] == 'complete' and r['finds'] == 6 for r in route['results'])
assert all(c['status'] == 0 for c in json.loads((ROOT / 'E32-checks.json').read_text())['checks'])
assert all(not r['errors'] for r in json.loads((ROOT / 'assets-validation.json').read_text()))
for r in json.loads((ROOT / 'asset-contracts.json').read_text())['rows']:
    assert hashlib.sha256(Path(r['file']).read_bytes()).hexdigest() == r['sha256'], r['file']
    if r['id'] == 'bld.cure-motor-shelter': assert r['roof']
    else: assert abs(r['bounds']['min'][1]) < .001
checks.append({'route': 'PASS', 'sourceHash': h.hexdigest(), 'sourceRevision': base, 'subsequentRenderOnlyChange': 'src/render/LevelTenEndingView.ts tableau camera coordinates, closing portrait fit and continuous pullback pose', 'E32': 'PASS', 'assets': 'PASS'})

sheets = json.loads((ROOT / 'sheets.json').read_text())['sheets']
assert len(sheets) == 7
for sheet in sheets:
    assert hashlib.sha256((ROOT / sheet['file']).read_bytes()).hexdigest() == sheet['sha256']
    for c in sheet['cells']:
        if Path(c['source']).exists(): assert hashlib.sha256(Path(c['source']).read_bytes()).hexdigest() == c['sha256']
checks.append({'retainedSheets': 7, 'hashes': 'PASS'})
(ROOT / 'audit.json').write_text(json.dumps({'pass': True, 'checks': checks}, indent=2) + '\n')
print('PASS: visual matrix, every-frame ending geometry, default/carry controls, gameplay-source route, checks, asset tiers and seven sheets.')
