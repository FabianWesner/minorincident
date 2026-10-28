"""Compose L9 review captures without resampling the 120/400-pixel figure cells."""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('test-results/l9-all-new')
OUT = Path('docs/reports/l9-all-new')
FONT = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
BG = '#23232d'
IDS = [row['id'] for row in json.loads((OUT / 'census.json').read_text())['identities'] if row.get('migration')]
CONFIGS = ['low-webgl2', 'high-webgpu', 'high-webgl2', 'low-webgpu']
index = []

def stack(images):
    result = Image.new('RGB', (max(im.width for im in images), sum(im.height for im in images)), BG)
    y = 0
    for im in images:
        result.paste(im, ((result.width - im.width) // 2, y))
        y += im.height
    return result

def grid(cells, width=800, cols=2):
    tiles = []
    for file, label in cells:
        im = Image.open(file).convert('RGB')
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

for number, ident in enumerate(IDS, 1):
    rows, sources = [], []
    for config in CONFIGS:
        path = ROOT / 'figures' / config / 'receipts.json'
        if not path.exists():
            continue
        receipts = [r for r in json.loads(path.read_text()) if r['id'] == ident]
        assert len(receipts) == 8, (config, ident, len(receipts))
        for pixels in [120, 400]:
            cells = []
            for yaw in [-45, 135]:
                for variant in ['old', 'new']:
                    r = next(r for r in receipts if (r['variant'], r['targetPixels'], r['yaw']) == (variant, pixels, yaw))
                    assert abs(r['actualPixels'] - pixels) < 2, r
                    a, b, c, d = r['bounds']
                    im = Image.open(r['file']).convert('RGB').crop((int(a)-12, int(b)-12, int(c)+13, int(d)+13))
                    cells.append((im, f'{variant} {pixels}px {"front" if yaw == -45 else "back"}'))
                    sources.append(r['file'])
            width = max(250, max(im.width for im, _ in cells) + 8)
            row = Image.new('RGB', (width * 4, max(im.height for im, _ in cells) + 54), BG)
            draw = ImageDraw.Draw(row)
            draw.text((8, 5), ident + ' | L9 crossing light | ' + config, font=FONT, fill='white')
            for k, (im, label) in enumerate(cells):
                row.paste(im, (width*k+(width-im.width)//2, 52))
                draw.text((width*k+8, 28), label, font=FONT, fill='white')
            rows.append(row)
    assert rows, ident
    file = OUT / f'{number:02}-{ident}.jpg'
    stack(rows).save(file, quality=93, optimize=True)
    index.append({'file': str(file), 'sources': sources, 'nativePixels': [120, 400]})

crowd_cells = [(ROOT/f'crowd-{v}-{c}'/'zoom-1.5.png', f'{c} | {v} | 30 figures | zoom 1.5') for c in CONFIGS for v in ['old', 'new']]
if all(p.exists() for p, _ in crowd_cells):
    zoom1 = [(ROOT/f'crowd-{v}-{c}'/'zoom-1.png', f'{c} | {v} | zoom 1') for c in CONFIGS for v in ['old', 'new']]
    file = OUT/'07-crowd-old-new.jpg'
    stack([grid(crowd_cells), grid(zoom1, width=400, cols=4)]).save(file, quality=93, optimize=True)
    index.append({'file': str(file), 'sources': [str(p) for p, _ in crowd_cells + zoom1]})
    showcase = grid(crowd_cells[:4]); showcase.thumbnail((1600, 1600))
    showcase.save(ROOT/'l9-crowd-old-new.jpg', quality=93, optimize=True)

states = [(ROOT/f'states-new-{c}'/f'{s}.png', f'{c} | {s}') for c in CONFIGS for s in ['live', 'corpse']]
if all(p.exists() for p, _ in states):
    file = OUT/'08-live-corpse.jpg'
    grid(states).save(file, quality=93, optimize=True)
    index.append({'file': str(file), 'sources': [str(p) for p, _ in states]})
story = []
for config in ['low-webgl2', 'high-webgpu']:
    folder = ROOT/f'story-new-{config}'
    for scene in sorted(folder.glob('*')):
        if not scene.is_dir():
            continue
        shots = sorted(scene.glob('shot-*.png'))
        selected = [shots[0], shots[-1]] if len(shots) > 1 else shots
        story.extend((p, f'{config} | {scene.name} | {p.stem}') for p in selected)
play = sorted((ROOT/'playtest'/'captures').glob('*.jpg'))
if play:
    picks = sorted(set([0, len(play)//3, 2*len(play)//3, len(play)-1]))
    story.extend((play[i], 'L9 real-input | '+play[i].stem) for i in picks)
if story:
    file = OUT/'09-scripted-scenes-playthrough.jpg'
    grid(story, width=400, cols=4).save(file, quality=93, optimize=True)
    index.append({'file': str(file), 'sources': [str(p) for p, _ in story]})
details = [(ROOT/f'crowd-new-{c}'/f'{ident}-{side}.png', f'{c} | {ident} | {side}') for c in ['low-webgl2', 'high-webgpu'] for ident in IDS for side in ['front', 'back']]
if all(p.exists() for p, _ in details):
    file = OUT/'10-runtime-skin-headwear-props.jpg'
    grid(details, width=400, cols=4).save(file, quality=93, optimize=True)
    index.append({'file': str(file), 'sources': [str(p) for p, _ in details]})
(OUT/'capture-index.json').write_text(json.dumps(index, indent=2)+'\n')
print(json.dumps({'reportCaptures': len(index)}))
