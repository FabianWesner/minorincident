"""Compose the paired game-camera strips and their measured frame annotations."""
import json
import hashlib
import math
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('test-results/r15-megarun')
OUT = Path('docs/reports/r15-megarun')
OUT.mkdir(parents=True, exist_ok=True)
FRAMES = [60, 66, 72, 78, 84, 90]
VIEWS = [f'{tier}-z{zoom}-{direction}' for tier in ['high', 'low'] for zoom in ['1', '1.5'] for direction in ['toward', 'away', 'across']]
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
small = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 12)
cell, gap, header, row_h = 160, 12, 38, 192
sheet = Image.new('RGB', (cell * 12 + gap, header + row_h * len(VIEWS)), '#20232b')
draw = ImageDraw.Draw(sheet)
draw.text((8, 9), 'OLD: shared infected sprint', font=font, fill='white')
draw.text((cell * 6 + gap + 8, 9), 'NEW: heavy Mega lope | same speed, model and game camera', font=font, fill='white')
rows, annotations = [], []
for index, view in enumerate(VIEWS):
    y = header + index * row_h
    draw.text((8, y + 1), view, font=font, fill='#f7d998')
    for side_index, side in enumerate(['before', 'after']):
        path = ROOT / side / view
        report = json.loads((path / 'metrics.json').read_text())
        subprocess.run(['node', 'tools/qa/r15-megarun-foot-slide.mjs', str(path / 'metrics.json')], stdout=subprocess.DEVNULL, check=False)
        slip = json.loads((path / 'foot-slide.json').read_text())
        track = {f['frame']: f for f in report['metrics']['actors']['mega']['track']}
        poses = {p['frame']: p['figure'] for p in report['poses']}
        cells = []
        for i, frame in enumerate(FRAMES):
            x = side_index * (cell * 6 + gap) + i * cell
            sheet.paste(Image.open(path / f'f{frame}.png').resize((cell, cell), Image.Resampling.LANCZOS), (x, y + 31))
            draw.text((x + 5, y + 17), f'f{frame}', font=small, fill='#e0e6ef')
            sample = track[frame]
            feet = [min(f['heel'][1], f['toe'][1]) - (sample.get('floor') or 0) for f in sample['feet']]
            head = poses[frame]['joints']['head'][1]
            labels = [f'{name} plant' if height <= .012 else f'{name} +{round(height * 100)}cm' for name, height in zip(['L', 'R'], feet)]
            cells.append(f'{", ".join(labels)}; H {head:.3f}m')
        heads = [p['joints']['head'][1] for p in poses.values()]
        motion = report['metrics']['actors']['mega']['motion']
        row = {'side': side, 'view': view, 'slip': slip, 'motion': motion, 'sampledHeadBobCm': round((max(heads) - min(heads)) * 100, 2), 'consoleErrors': report['consoleErrors'], 'lod': report['metrics']['actors']['mega']['lod'], 'drawCallsMax': report['metrics']['perf']['drawCalls']['max'], 'trianglesMax': report['metrics']['perf']['triangles']['max']}
        rows.append(row)
        annotations.append(f'| {view} / {side} | ' + ' | '.join(cells) + ' |')
        if side == 'after':
            assert slip['pass'], (view, slip)
            assert not report['consoleErrors'], (view, report['consoleErrors'])
sheet.save(OUT / 'compare.jpg', quality=83, optimize=True)
native = []
for case in ['after-speed1.2', 'after-speed6.48', 'after-speed11', 'after-speed14', 'after-turn', 'after-zoom3-modelinf.mega-alpha']:
    path = next((ROOT / case).glob('*/metrics.json'))
    subprocess.run(['node', 'tools/qa/r15-megarun-foot-slide.mjs', str(path)], check=True, stdout=subprocess.DEVNULL)
    report = json.loads(path.read_text())
    poses = report['poses']
    used = [f for f in report['metrics']['actors']['mega']['track'] if f['frame'] >= 30]
    rate = sum((b['figure']['phase'] - a['figure']['phase']) % 1 for a, b in zip(poses, poses[1:])) / ((poses[-1]['frame'] - poses[0]['frame']) / 60)
    headings, banks = [], []
    for pose in poses:
        figure = pose['figure']; left, right = [figure['joints'][name] for name in ['armL', 'armR']]
        banks.append(math.degrees(math.atan2(left[1] - right[1], math.hypot(left[0] - right[0], left[2] - right[2]))))
        headings.append(math.degrees(math.atan2(-figure['forward'][2], figure['forward'][0])))
    native.append({'case': case, 'slip': json.loads(path.with_name('foot-slide.json').read_text()), 'phaseCyclesPerS': round(rate, 3), 'actualSpeedMaxMs': round(max(f['speed'] for f in used), 4), 'steadySwingMaxCm': round(max(min(foot['heel'][1], foot['toe'][1]) - (f.get('floor') or 0) for f in used for foot in f['feet']) * 100, 2), 'headingSamplesDeg': headings, 'bankSamplesDeg': banks, 'consoleErrors': report['consoleErrors'], 'lod': report['metrics']['actors']['mega']['lod']})
    assert not report['consoleErrors'], case
    if case in ['after-speed11', 'after-speed14']:
        assert abs(rate - 2.2) < .02, (case, rate)
        assert abs(native[-1]['actualSpeedMaxMs'] - float(case.split('speed')[1])) < .02
specials = []
for name in ['l10-mega-charge', 'l10-mega-slam', 'l10-mega-grab']:
    report = json.loads((ROOT / 'moves' / name / 'metrics.json').read_text())
    assert report['checks']['pass'] and not report['consoleErrors'], name
    assert {'active', 'recovery'} <= {s['stage'] for s in report['metrics']['specials']}, name
    specials.append({'scene': name, 'pass': True, 'consoleErrors': report['consoleErrors'], 'stages': report['metrics']['specials'], 'clipping': report['clipping']['summary']})
source_paths = subprocess.check_output(['git', 'diff', '--name-only', '78219de9', '--', 'src', 'tests']).decode().splitlines()
source_hashes = {p: hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in source_paths if Path(p).is_file()}
assets = {}
for path in sorted(Path('public/assets/models/skinned').glob('inf.mega-alpha*.glb')):
    original = subprocess.check_output(['git', 'show', f'78219de9:{path}'])
    assert original == path.read_bytes(), f'Mega model changed: {path}'
    assets[str(path)] = hashlib.sha256(original).hexdigest()
assert len(assets) == 18 and len(set(assets.values())) == 9, assets
libraries = {}
for name in ['library.json', 'library.skin.json']:
    path = Path('src/render/characters') / name
    original = subprocess.check_output(['git', 'show', f'78219de9:{path}'])
    assert original == path.read_bytes(), f'Clip library changed: {path}'
    libraries[str(path)] = hashlib.sha256(original).hexdigest()
evidence = {'baselineRevision': '78219de9', 'implementationRevision': subprocess.check_output(['git', 'log', '-1', '--format=%H', '--', 'src/render/CrowdView.ts', 'src/sim/missions/LevelEightZoo.ts']).decode().strip(), 'sourceSha256': source_hashes, 'unchangedMegaLodSha256': assets, 'unchangedClipLibrarySha256': libraries, 'runningViews': rows, 'nativeCases': native, 'specialMoves': specials}
gate = Path('test-results/epics/E07/checks.json')
if gate.exists():
    evidence['epicGate'] = json.loads(gate.read_text())
    assert all(c['status'] == 0 for c in evidence['epicGate']['checks'])
smoke = {}
def smoke_specs(suites):
    for suite in suites:
        yield from suite.get('specs', [])
        yield from smoke_specs(suite.get('suites', []))
for name in ['smoke.json', 'smoke-rerun.json']:
    path = ROOT / name
    if path.exists():
        for spec in smoke_specs(json.loads(path.read_text())['suites']):
            for test in spec['tests']:
                smoke[spec['title']] = {'file': spec['file'], 'title': spec['title'], 'status': test['results'][-1]['status'], 'receipt': str(path)}
assert len(smoke) == 3 and all(s['status'] == 'passed' for s in smoke.values()), smoke
evidence['webgl2Smoke'] = list(smoke.values())
evidence['boardingFixtureAudit'] = {side: json.loads((ROOT / f'boarding-{side}.json').read_text()) for side in ['baseline', 'after']}
(OUT / 'evidence.json').write_text(json.dumps(evidence, indent=2) + '\n')
table = '| View / version | f60 | f66 | f72 | f78 | f84 | f90 |\n|---|---|---|---|---|---|---|\n' + '\n'.join(annotations) + '\n'
readme = (OUT / 'README.md').read_text().split('<!-- FRAME REVIEW -->')[0]
(OUT / 'README.md').write_text(readme + '<!-- FRAME REVIEW -->\n\n' + table)
print(json.dumps({'compareBytes': (OUT / 'compare.jpg').stat().st_size, 'afterMaxSlipP95': max(r['slip']['p95'] for r in rows if r['side'] == 'after'), 'afterMaxSampledHeadBobCm': max(r['sampledHeadBobCm'] for r in rows if r['side'] == 'after')}, indent=2))
