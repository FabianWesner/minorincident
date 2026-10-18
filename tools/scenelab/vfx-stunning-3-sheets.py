"""Before/after comparison sheets and Scene Lab cost table for lane vfx-stunning-3.

Run after `tools/scenelab/vfx-stunning.ts before|after` with VFX_OUT=vfx3:
  python3 tools/scenelab/vfx-stunning-3-sheets.py
One sheet per scene and backend: rows = tier x zoom, columns = key frames BEFORE | AFTER (original pixels, scaled).
"""
import json
import os
import math
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path('test-results/vfx3')
OUT = Path('docs/reports/vfx-stunning-3')
(OUT / 'sheets').mkdir(parents=True, exist_ok=True)
KEYS = {'vfx-explosion': [20, 50, 110], 'vfx-rifle-impact': [16, 28, 44],
        'vfx-molotov-fire': [24, 72, 168], 'vfx-vehicle-crash': [192, 216, 288], 'vfx-smoke-column': [90, 270, 510]}
CW, CH = 196, 110
# Same zoom list as the runner (VFX_ZOOMS); folder names use JS number formatting (.5 -> 0.5).
ZOOMS = [z if not z.startswith('.') else '0' + z for z in os.environ.get('VFX_ZOOMS', '1.5,1,.5').split(',')]


def frames_of(spec):
    frames = list(range(0, spec['frames'] + 1, spec['sheet']))
    if len(frames) > 24:
        frames = [frames[math.floor(i * (len(frames) - 1) / 23 + .5)] for i in range(24)]
    return frames


def cell(phase, name, config, frame):
    spec = json.loads(Path(f'tests/scenes/catalog/{name}.json').read_text())
    frames = frames_of(spec)
    index = min(range(len(frames)), key=lambda i: abs(frames[i] - frame))
    cols = len(frames) if len(frames) <= 4 else 4 if len(frames) <= 12 else 6
    path = ROOT / phase / f'{name}@{config}' / 'sheet.jpg'
    if not path.exists():
        return None, frames[index]
    image = Image.open(path)
    x, y = index % cols * 322, index // cols * 182
    return image.crop((x, y, x + 320, y + 180)).resize((CW, CH), Image.LANCZOS), frames[index]


rows = []
configs = [(tier, zoom) for tier in ['high', 'low'] for zoom in ZOOMS]
for name, keys in KEYS.items():
    for backend in ['webgl2', 'webgpu']:
        canvas = Image.new('RGB', (110 + 2 * len(keys) * (CW + 4) + 12, 46 + len(configs) * (CH + 18)), '#161b22')
        draw = ImageDraw.Draw(canvas)
        draw.text((10, 6), f'{name} / {backend} - BEFORE (main c31833b) left, AFTER right; game camera', fill='white')
        draw.text((110, 26), 'BEFORE', fill='#ffdf9d')
        draw.text((110 + len(keys) * (CW + 4) + 12, 26), 'AFTER', fill='#9dffc8')
        for r, (tier, zoom) in enumerate(configs):
            config = f'{backend}-{tier}-z{zoom}'
            y = 46 + r * (CH + 18)
            draw.text((8, y + 40), f'{tier} z{zoom}', fill='white')
            for j, phase in enumerate(['before', 'after']):
                for k, frame in enumerate(keys):
                    shot, actual = cell(phase, name, config, frame)
                    x = 110 + j * (len(keys) * (CW + 4) + 12) + k * (CW + 4)
                    if shot:
                        canvas.paste(shot, (x, y))
                    draw.text((x, y + CH + 2), f'f{actual}', fill='#b7c7d9')
                metrics = ROOT / phase / f'{name}@{config}' / 'metrics.json'
                if metrics.exists():
                    data = json.loads(metrics.read_text())
                    perf = data['metrics']['perf']
                    rows.append(dict(scene=name, phase=phase, backend=backend, tier=tier, zoom=float(zoom),
                                     passed=data['checks']['pass'], draws=perf['drawCalls']['max'],
                                     triangles=perf['triangles']['max'], cpuP50=perf['stepMs']['p50'],
                                     cpuP95=perf['stepMs']['p95'], cpuMax=perf['stepMs']['max'],
                                     consoleErrors=len(data['consoleErrors'])))
        canvas.save(OUT / 'sheets' / f'{name.replace("vfx-", "")}-{backend}.jpg', quality=86)

(OUT / 'scene-costs.json').write_text(json.dumps(dict(note='Scene Lab CPU sim + render submission (stepMs), shared Mac, not native GPU frame time.', rows=rows), indent=2) + '\n')
lines = ['| Scene | Backend | Tier | CPU p95 ms before → after | Max frame ms before → after | Draws before → after | Triangles before → after |', '| --- | --- | --- | --- | --- | --- | --- |']
for name in KEYS:
    for backend in ['webgl2', 'webgpu']:
        for tier in ['high', 'low']:
            pair = [next((r for r in rows if r['scene'] == name and r['backend'] == backend and r['tier'] == tier and r['zoom'] == 1 and r['phase'] == p), None) for p in ['before', 'after']]
            if None in pair:
                continue
            a, b = pair
            lines.append(f"| {name[4:]} | {backend} | {tier} | {a['cpuP95']} → {b['cpuP95']} | {a['cpuMax']} → {b['cpuMax']} | {a['draws']} → {b['draws']} | {a['triangles']} → {b['triangles']} |")
(OUT / 'costs.md').write_text('# Scene Lab cost per effect (zoom 1)\n\nCPU sim + render submission per frame (stepMs), shared Mac, not native GPU time. Max frame of the first scene in each session (explosion) is the cold first blast.\n\n' + '\n'.join(lines) + '\n')
print(f'{len(rows)} measurements; {sum(r["passed"] for r in rows)} passed')
