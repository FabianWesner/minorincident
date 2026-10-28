"""Compose native-pixel L7 figure reviews and the two runtime contact sheets."""
import json
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('test-results/l7-all-new')
OUT = Path('docs/reports/l7-all-new')
FONT = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
BG = '#23232d'
IDS = json.loads((OUT / 'census.json').read_text())['review']
index = []

def grid(cells, width=800, cols=2, crop=None):
    tiles = []
    for file, label in cells:
        im = Image.open(file).convert('RGB')
        if crop:
            im = im.crop(crop)
        height = round(im.height * width / im.width)
        tile = Image.new('RGB', (width, height + 30), BG)
        tile.paste(im.resize((width, height), Image.Resampling.LANCZOS), (0, 30))
        ImageDraw.Draw(tile).text((7, 7), label, font=FONT, fill='white')
        tiles.append(tile)
    height = max(tile.height for tile in tiles)
    sheet = Image.new('RGB', (width * cols, height * math.ceil(len(tiles) / cols)), BG)
    for i, tile in enumerate(tiles):
        sheet.paste(tile, (i % cols * width, i // cols * height))
    return sheet

def stack(images):
    result = Image.new('RGB', (max(im.width for im in images), sum(im.height for im in images)), BG)
    y = 0
    for im in images:
        result.paste(im, ((result.width - im.width) // 2, y))
        y += im.height
    return result

for number, ident in enumerate(IDS, 1):
    rows, sources = [], []
    for folder in sorted((ROOT / 'figures').iterdir()):
        path = folder / 'receipts.json'
        if not path.exists():
            continue
        receipts = [r for r in json.loads(path.read_text()) if r['id'] == ident]
        if not receipts:
            continue
        assert len(receipts) == 8, (folder, ident, len(receipts))
        for pixels in [120, 400]:
            cells = []
            for yaw in [-45, 135]:
                for variant in ['old', 'new']:
                    r = next(r for r in receipts if (r['variant'], r['targetPixels'], r['yaw']) == (variant, pixels, yaw))
                    a, b, c, d = r['bounds']
                    im = Image.open(r['file']).convert('RGB').crop((int(a)-12, int(b)-12, int(c)+13, int(d)+13))
                    cells.append((im, f'{variant} {pixels}px {"front" if yaw == -45 else "back"}'))
                    sources.append(r['file'])
            width = max(240, max(im.width for im, _ in cells) + 8)
            row = Image.new('RGB', (width * 4, max(im.height for im, _ in cells) + 54), BG)
            draw = ImageDraw.Draw(row)
            draw.text((8, 5), folder.name + ' | retained rigid baseline / L7 v2', font=FONT, fill='white')
            for k, (im, label) in enumerate(cells):
                row.paste(im, (width*k+(width-im.width)//2, 52))
                draw.text((width*k+8, 28), label, font=FONT, fill='white')
            rows.append(row)
    runtime_pairs = [('low-webgl2', 'old'), ('high-webgpu', 'old')]
    if ident == 'npc.civilian-man-b':
        runtime_pairs.append(('high-webgpu', 'main'))
    for config, left in runtime_pairs:
        paths = [ROOT/f'portraits-{variant}-{config}'/'receipts.json' for variant in [left, 'new']]
        if not all(path.exists() for path in paths):
            continue
        receipts = [r for path in paths for r in json.loads(path.read_text()) if r['id'] == ident]
        if len(receipts) != 8:
            continue
        for pixels in [120, 400]:
            cells = []
            for yaw in [-45, 135]:
                for variant in [left, 'new']:
                    r = next(r for r in receipts if (r['variant'], r['targetPixels'], r['yaw']) == (variant, pixels, yaw))
                    assert abs(r['actualPixels'] - pixels) < 2, r
                    a, b, c, d = r['bounds']
                    im = Image.open(r['file']).convert('RGB').crop((int(a)-12, int(b)-12, int(c)+13, int(d)+13))
                    cells.append((im, f'{variant} ~{pixels}px {"front" if yaw == -45 else "back"}'))
                    sources.append(r['file'])
            width = max(240, max(im.width for im, _ in cells) + 8)
            row = Image.new('RGB', (width * 4, max(im.height for im, _ in cells) + 54), BG)
            draw = ImageDraw.Draw(row)
            context = 'shipped main v2 / L7 brim correction' if left == 'main' else 'actual L7 runtime: ' + ('infected' if ident in IDS[:5] else 'healthy follower')
            draw.text((8, 5), config + ' | ' + context, font=FONT, fill='white')
            for k, (im, label) in enumerate(cells):
                row.paste(im, (width*k+(width-im.width)//2, 52))
                draw.text((width*k+8, 28), label, font=FONT, fill='white')
            rows.append(row)
    assert len(rows) >= 8, (ident, len(rows))
    file = OUT / f'{number:02}-{ident}.jpg'
    stack(rows).save(file, quality=92, optimize=True)
    index.append({'file': str(file), 'sources': sources, 'nativePixels': [120, 400]})

if '--figures-only' in sys.argv:
    sys.exit(0)

configs = ['low-webgl2', 'high-webgpu', 'high-webgl2', 'low-webgpu']
crowd_cells = [(ROOT/f'crowd-{v}-{c}'/'zoom-1.5.png', f'{c} | {"retained rigid" if v == "old" else "L7 v2"} | 30 figures') for c in configs for v in ['old', 'new']]
crowd = grid(crowd_cells)
zoom1_cells = [(ROOT/f'crowd-{v}-{c}'/'zoom-1.png', f'{c} | {v} | zoom 1') for c in configs for v in ['old', 'new']]
states = grid([(ROOT/f'states-new-{c}'/f'{s}.png', f'{c} | {s}') for c in ['low-webgl2', 'high-webgpu'] for s in ['live', 'turned', 'corpse', 'alpha', 'alpha-corpse']], width=400, cols=4)
weapons = grid([(ROOT/f'crowd-new-{c}'/f'marcus-{s}.png', f'{c} | Marcus live pistol {s}') for c in ['low-webgl2', 'high-webgpu'] for s in ['front', 'back']], width=400, cols=4, crop=(400, 150, 1200, 850))
file = OUT/'13-crowd-states-weapons.jpg'
stack([crowd, grid(zoom1_cells, width=400, cols=4), states, weapons]).save(file, quality=92, optimize=True)
index.append({'file': str(file), 'sources': [str(p) for p, _ in crowd_cells + zoom1_cells], 'includes': ['30-figure street crowd at zoom 1 and 1.5', 'healthy/turned/frozen NPCs and Alphas', 'Marcus live pistol front/back']})
if '--crowd-only' in sys.argv:
    sys.exit(0)

story = []
for config in ['low-webgl2', 'high-webgpu']:
    folder = ROOT/f'story-new-{config}'
    for scene in sorted(p for p in folder.iterdir() if p.is_dir()):
        shots = [p for p in sorted(scene.glob('shot-*.png')) if any(hi > 0 for lo, hi in Image.open(p).convert('RGB').getextrema())]
        selected = [shots[0], shots[-1]] if len(shots) > 1 else shots
        story.extend((p, f'{config} | {scene.name} | {p.stem}') for p in selected)
play = sorted((ROOT/'playthrough'/'captures').glob('*-t[1-9]*.jpg'), key=lambda p: p.stat().st_mtime)
play_cells = []
if play:
    indices = sorted(set([0, len(play)//3, 2*len(play)//3, len(play)-1]))
    play_cells = [(play[i], f'real-input L7 | {play[i].stem}') for i in indices]
file = OUT/'14-scripted-scenes.jpg'
panels = [grid(story, width=400, cols=4)]
if play_cells:
    panels.append(grid(play_cells, width=800, cols=2))
stack(panels).save(file, quality=91, optimize=True)
index.append({'file': str(file), 'sources': [str(p) for p, _ in story + play_cells]})

showcase = grid(crowd_cells[:4])
showcase.thumbnail((1600, 1600))
file = ROOT/'l7-crowd-old-new.jpg'
showcase.save(file, quality=92, optimize=True)
(OUT/'capture-index.json').write_text(json.dumps(index, indent=2)+'\n')
print(json.dumps({'reportCaptures': len(index), 'showcase': str(file), 'showcaseSize': showcase.size}))
