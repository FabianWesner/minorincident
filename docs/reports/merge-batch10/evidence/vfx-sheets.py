"""Compose unchanged Scene Lab capture cells and summarize CPU submission timings.

Run after vfx-stunning.ts: python3 tools/scenelab/vfx-stunning-sheets.py
Requires Pillow, as the other repository capture-sheet tools do. No generated art.
"""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path('test-results/vfx-stunning')
OUT = Path('docs/reports/merge-batch10/vfx-final')
(OUT / 'sheets').mkdir(parents=True, exist_ok=True)
SCENES = {p.stem: json.loads(p.read_text()) for p in sorted(Path('tests/scenes/catalog').glob('vfx-*.json')) if p.stem in ('vfx-rifle-cover', 'vfx-vehicle-contact')}
PEAK = {'vfx-alpha-hit': 24, 'vfx-explosion': 24, 'vfx-gore': 24,
        'vfx-molotov-fire': 60, 'vfx-rifle-cover': 24, 'vfx-rifle-impact': 16,
        'vfx-shotgun-impact': 16, 'vfx-vehicle-contact': 96, 'vfx-vehicle-crash': 30}


def cell(phase, name, config, frame):
    spec = SCENES[name]
    frames = list(range(0, spec['frames'] + 1, spec['sheet']))
    if len(frames) > 24:
        frames = [frames[math.floor(i * (len(frames) - 1) / 23 + .5)] for i in range(24)]
    index = min(range(len(frames)), key=lambda i: abs(frames[i] - frame))
    cols = len(frames) if len(frames) <= 4 else 4 if len(frames) <= 12 else 6
    image = Image.open(ROOT / phase / f'{name}@{config}' / 'sheet.jpg')
    x, y = index % cols * 322, index // cols * 182
    return image.crop((x, y, x + 320, y + 180)), frames[index]


rows = []
for backend in ['webgl2', 'webgpu']:
    for tier in ['high', 'low']:
        for zoom in [1, .5]:
            config = f'{backend}-{tier}-z{zoom}'
            canvas = Image.new('RGB', (850, 60 + len(SCENES) * 208), '#161b22')
            draw = ImageDraw.Draw(canvas)
            draw.text((12, 8), f'{backend} / {tier} / zoom {zoom} - original game-camera pixels', fill='white')
            draw.text((190, 30), 'BEFORE', fill='#ffdf9d')
            draw.text((520, 30), 'AFTER', fill='#9dffc8')
            for i, name in enumerate(SCENES):
                y = 60 + i * 208
                draw.text((8, y + 15), name.replace('vfx-', ''), fill='white')
                for j, phase in enumerate(['before', 'after']):
                    shot, frame = cell(phase, name, config, PEAK[name])
                    canvas.paste(shot, (190 + j * 330, y))
                    draw.text((190 + j * 330, y + 184), f'f{frame}', fill='#b7c7d9')
                    data = json.loads((ROOT / phase / f'{name}@{config}' / 'metrics.json').read_text())
                    perf = data['metrics']['perf']
                    rows.append(dict(scene=name, phase=phase, backend=backend, tier=tier, zoom=zoom,
                                     passed=data['checks']['pass'], draws=perf['drawCalls']['max'],
                                     triangles=perf['triangles']['max'], cpuP50=perf['stepMs']['p50'],
                                     cpuP95=perf['stepMs']['p95'], cpuMax=perf['stepMs']['max'],
                                     consoleErrors=len(data['consoleErrors'])))
            canvas.save(OUT / 'sheets' / f'{config}.jpg', quality=88)

for name in SCENES:
    canvas = Image.new('RGB', (970, 60 + 2 * 3 * 208), '#161b22')
    draw = ImageDraw.Draw(canvas)
    draw.text((12, 8), f'{name} - BEFORE (left) / AFTER (right)', fill='white')
    for group, config in enumerate(['webgl2-high-z1', 'webgl2-low-z0.5']):
        for i, frame in enumerate([PEAK[name], PEAK[name] + 16, SCENES[name]['frames']]):
            y = 60 + (group * 3 + i) * 208
            draw.text((8, y + 15), config, fill='white')
            for j, phase in enumerate(['before', 'after']):
                shot, actual = cell(phase, name, config, frame)
                canvas.paste(shot, (310 + j * 330, y))
                draw.text((310 + j * 330, y + 184), f'f{actual}', fill='#b7c7d9')
    canvas.save(OUT / 'sheets' / f'{name}.jpg', quality=88)

(OUT / 'scene-costs.json').write_text(json.dumps(dict(note='Scene Lab CPU sim + render submission, not native GPU frame time; non-quiet concurrent runs. Cold maxima include compilation/loading.', rows=rows), indent=2) + '\n')
lines = ['# Scene Lab cost per effect', '',
         'CPU submission p95 in ms, at zoom 1. Draws/triangles are maxima. These shared-Mac timings are **not E18 native frame-time certification**; see scene-costs.json for every zoom and cold maximum.', '',
         '| Effect | Backend | Tier | CPU p95 before → after | Draws before → after | Triangles before → after |',
         '| --- | --- | --- | --- | --- | --- |']
for name in SCENES:
    for backend in ['webgl2', 'webgpu']:
        for tier in ['high', 'low']:
            pair = [next(r for r in rows if r['scene'] == name and r['backend'] == backend and r['tier'] == tier and r['zoom'] == 1 and r['phase'] == p) for p in ['before', 'after']]
            a, b = pair
            lines.append(f"| {name} | {backend} | {tier} | {a['cpuP95']} → {b['cpuP95']} | {a['draws']} → {b['draws']} | {a['triangles']} → {b['triangles']} |")
(OUT / 'costs.md').write_text('\n'.join(lines) + '\n')
print(f'{len(rows)} measurements; {sum(r["passed"] for r in rows)} passed; 17 comparison sheets in {OUT / "sheets"}')
