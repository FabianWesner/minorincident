"""Compare the complete accepted-prop/native matrix; keep screenshots local and archive hashes/metrics."""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

root = Path('test-results/epics/E25')
fixtures = json.loads(Path('docs/reports/e25-emitters/evidence/visual-fixtures.json').read_text())
expected = len(fixtures) * 2 + 8
rows, changed = [], []
world_ids = {d['id'] for d in json.loads(Path('src/assets/manifest.json').read_text()) if d.get('world')}
for tier in ('high', 'low'):
    before = json.loads((root / 'emitters-before' / tier / 'captures.json').read_text())
    after = json.loads((root / 'emitters-after' / tier / 'captures.json').read_text())
    assert len(before) == len(after) == expected, (tier, len(before), len(after), expected)
    prior = {(r['name'], r['zoom']): r for r in before}
    assert len(prior) == expected
    assert len({(r['name'], r['zoom']) for r in after}) == expected
    assert {(r['name'], r['zoom']) for r in after} == set(prior)
    for phase in (before, after):
        zooms = {(r['name'], r['zoom']): r for r in phase}
        for name in {r['name'] for r in phase}:
            assert zooms[(name, 1)]['sha256'] != zooms[(name, 1.5)]['sha256'], (name, tier, 'duplicate zoom frames')
            assert abs(zooms[(name, 1.5)]['actualRadius'] / zooms[(name, 1)]['actualRadius'] - 1.5) < 1e-6

    for current in after:
        old = prior[(current['name'], current['zoom'])]
        assert old['tier'] == current['tier'] == tier
        assert old['tick'] == current['tick'], (current['name'], old['tick'], current['tick'])
        assert abs(old['camera']['zoom'] - current['zoom']) < 1e-6
        assert abs(current['camera']['zoom'] - current['zoom']) < 1e-6
        assert abs(old['calibratedZoom'] - current['zoom']) < 1e-6
        assert abs(current['calibratedZoom'] - current['zoom']) < 1e-6
        assert np.allclose(old['camera']['position'], current['camera']['position'], atol=1e-6)
        assert np.allclose(old['camera']['target'], current['camera']['target'], atol=1e-6)
        assert old['camera']['fov'] == current['camera']['fov']
        if current['kind'] == 'prop':
            assert abs(current['actualRadius'] - 19 * current['zoom']) < 1e-6
            assert abs(old['actualRadius'] - 19 * old['zoom']) < 1e-6
        assert not old['errors'] and not current['errors'], (current['name'], old['errors'], current['errors'])
        for capture in (old, current):
            assert hashlib.sha256(Path(capture['path']).read_bytes()).hexdigest() == capture['sha256']
            if capture.get('asset') in world_ids:
                assert any(r['assetId'] == capture['asset'] and r['lod'] != 'culled' for r in capture['lods']), (capture['name'], 'prop was not drawn')
        a, b = Image.open(old['path']).convert('RGBA'), Image.open(current['path']).convert('RGBA')
        assert a.size == b.size == (1280, 720)
        left, right = np.asarray(a), np.asarray(b)
        mask = np.any(left != right, axis=2)
        count = int(mask.sum())
        delta = np.abs(left[:, :, :3].astype(np.int16) - right[:, :, :3].astype(np.int16))
        ys, xs = np.where(mask)
        row = {k: current[k] for k in ('name', 'zoom', 'level', 'kind', 'tick')}
        row.update(tier=tier, camera=current['camera'], actualRadius=current['actualRadius'], calibratedZoom=current['calibratedZoom'], before=old['path'], after=current['path'],
                   beforeSHA256=hashlib.sha256(Path(old['path']).read_bytes()).hexdigest(),
                   afterSHA256=hashlib.sha256(Path(current['path']).read_bytes()).hexdigest(),
                   changedPixels=count, pixels=int(mask.size), meanChannelDelta=float(delta.mean()), maxChannelDelta=int(delta.max()),
                   changedBounds=[int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())] if count else None)
        rows.append(row)
        if count:
            changed.append(row)

sheets = []
output = root / 'emitters-comparison'
output.mkdir(parents=True, exist_ok=True)
for page in range((len(changed) + 3) // 4):
    cells = changed[page * 4:(page + 1) * 4]
    sheet = Image.new('RGB', (960, len(cells) * 202), '#202020')
    draw = ImageDraw.Draw(sheet)
    for index, r in enumerate(cells):
        y = index * 202
        draw.text((4, y + 3), f"{r['name']} {r['tier']} z{r['zoom']} | changed {r['changedPixels']} px | before / after / 4x absolute delta", fill='white')
        a, b = Image.open(r['before']).convert('RGB'), Image.open(r['after']).convert('RGB')
        delta = np.abs(np.asarray(a).astype(np.int16) - np.asarray(b).astype(np.int16))
        diff = Image.fromarray(np.clip(delta * 4, 0, 255).astype(np.uint8))
        for x, im in enumerate((a, b, diff)):
            sheet.paste(im.resize((320, 180)), (x * 320, y + 22))
    path = output / f'changed-{page + 1:02}.png'
    sheet.save(path)
    sheets.append({'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'rows': [r['name'] + ':' + r['tier'] + ':' + str(r['zoom']) for r in cells]})

report = {'method': 'Entire RGBA frame comparison at 1280x720. Identical seeds, clock ticks, fixed renderer node time and content-based depth tie ordering. No pixel regions excluded from the paired frames.',
          'pairs': len(rows), 'identical': sum(r['changedPixels'] == 0 for r in rows),
          'changed': len(changed), 'acceptedChanged': sum(r['level'] != 'equipment-night' for r in changed),
          'equipmentChanged': sum(r['level'] == 'equipment-night' for r in changed), 'rows': rows, 'sheets': sheets}
Path('docs/reports/e25-emitters/evidence/visual-comparison.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k not in ('rows', 'sheets')}, indent=2))
