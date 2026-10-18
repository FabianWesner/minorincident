"""Compose paired campaign stills, plus structural counters; no image retouching."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

root = Path('docs/reports/atmosphere')
output_root = Path('docs/reports/merge-batch10')
for backend in ('webgl2', 'webgpu'):
    output = output_root / 'sheets' / ('atmosphere-' + backend)
    output.mkdir(parents=True, exist_ok=True)
    for level in (5, 9, 10):
        sheet = Image.new('RGB', (1280, 642), '#171b24')
        draw = ImageDraw.Draw(sheet)
        for row, zoom in enumerate((.5, 1, 1.5)):
            for col, (tier, phase) in enumerate((('high', 'before'), ('high', 'batch10'), ('low', 'before'), ('low', 'batch10'))):
                x, y = col * 320, row * 214
                draw.text((x + 5, y + 5), f'L{level} {tier} z{zoom:g} {phase} {backend}', fill='white')
                file = root / phase / backend / f'L{level}-{tier}-z{zoom:g}.jpg'
                if file.exists():
                    image = Image.open(file)
                    image.thumbnail((320, 180))
                    sheet.paste(image, (x, y + 26))
                else:
                    draw.text((x + 5, y + 60), 'NOT CAPTURED', fill='red')
        sheet.save(output / f'L{level}.jpg', quality=88)

rows = []
for backend in ('webgl2', 'webgpu'):
    files = [root / phase / backend / 'index.json' for phase in ('before', 'batch10')]
    if not all(file.exists() for file in files):
        continue
    before, after = [json.loads(file.read_text()) for file in files]
    by_key = {(r['level'], r['tier'], r['zoom']): r for r in before if 'zoom' in r}
    for a in after:
        if 'zoom' not in a:
            rows.append(a)
            continue
        b = by_key[(a['level'], a['tier'], a['zoom'])]
        p, q = b['perf'], a['perf']
        rows.append({k: a[k] for k in ('level', 'tier', 'zoom')} | {'backend': backend,
            'beforeDraws': p['drawCalls'], 'afterDraws': q['drawCalls'],
            'beforeTriangles': p['triangles'], 'afterTriangles': q['triangles'],
            'drawDelta': q['drawCalls'] - p['drawCalls'], 'triangleDelta': q['triangles'] - p['triangles'],
            'withinDrawTriangleBudget': q['drawCalls'] <= (600 if a['tier'] == 'high' else 300)
                and q['triangles'] <= (1500000 if a['tier'] == 'high' else 500000),
            'actualBackend': a['render']['backend'], 'actualTier': a['render']['quality']})
(output_root / 'atmosphere-counters.json').write_text(json.dumps(rows, indent=2) + '\n')
