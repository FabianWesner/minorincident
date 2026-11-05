"""Retained side-by-side comparison sheets from the paired browser receipts."""
from pathlib import Path
from collections import defaultdict
import json
from PIL import Image, ImageDraw

root = Path('test-results/release-ab-1101')
output = root / 'review'
output.mkdir(exist_ok=True)
manifest = []

def sheet(name, cells, width=640):
    height = width * 720 // 1280
    canvas = Image.new('RGB', (width * 2, len(cells) * (height + 28) + 30), '#17191e')
    draw = ImageDraw.Draw(canvas)
    draw.text((8, 8), name + ' | PROD 793be6bd3 (left) / candidate cdaed6356 (right)', fill='white')
    for i, (label, pair) in enumerate(cells):
        top = 30 + i * (height + 28)
        draw.text((8, top + 6), label, fill='white')
        for side, file in enumerate(pair):
            image = Image.open(file).convert('RGB').resize((width, height), Image.Resampling.LANCZOS)
            canvas.paste(image, (side * width, top + 28))
    destination = output / (name + '.jpg')
    canvas.save(destination, quality=80, optimize=True)
    manifest.append({'name': name, 'image': str(destination.relative_to(root)), 'pairs': len(cells), 'sources': [[str(p.relative_to(root)) for p in pair] for _, pair in cells]})

for mode in ('scenes', 'strips', 'effects'):
    for backend in ('webgpu', 'webgl2'):
        folder = root / mode / backend
        if not folder.exists(): continue
        groups = defaultdict(dict)
        for file in sorted(folder.glob('*.json')):
            rows = json.loads(file.read_text())
            for row in rows:
                if row.get('failure') or row.get('errors'): continue
                key = row.get('level') if mode == 'strips' else row['stop']['id'] if mode == 'scenes' else row['name']
                groups[key][row['side']] = row
        if mode == 'scenes':
            levels = defaultdict(list)
            for key, sides in groups.items():
                if set(sides) != {'prod', 'candidate'}: continue
                levels[sides['prod']['stop']['level']].append((key, [folder / sides[s]['image'] for s in ('prod', 'candidate')]))
            for level, cells in levels.items(): sheet(f'{level}-scenes-{backend}', cells)
        else:
            for key, sides in groups.items():
                if set(sides) != {'prod', 'candidate'}: continue
                if mode == 'strips':
                    images = [sides[s]['images'] for s in ('prod', 'candidate')]
                    cells = [(f'wall time approximately +{i * 6}s', [folder / images[s][i] for s in range(2)]) for i in range(min(map(len, images)))]
                else:
                    frames = [sides[s]['frames'] for s in ('prod', 'candidate')]
                    cells = [(f'frame {frames[0][i]["frame"]}', [folder / frames[s][i]['image'] for s in range(2)]) for i in range(min(map(len, frames)))]
                sheet(f'{key}-{mode}-{backend}', cells)
(output / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'{len(manifest)} paired sheets in {output}')
