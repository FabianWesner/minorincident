"""Compose the reviewed L6 native-pixel comparisons and production scene captures."""
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path('test-results/l6-all-new')
OUT = Path('docs/reports/l6-all-new')
FONT = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14)
BG = '#23232d'
IDS = json.loads((OUT / 'census.json').read_text())['converted']

def grid(cells, dest, width=800, cols=2, crop=None, aspect=9/16):
    height = round(width * aspect) + 30
    sheet = Image.new('RGB', (width * cols, height * math.ceil(len(cells) / cols)), BG)
    draw = ImageDraw.Draw(sheet)
    for i, (file, label) in enumerate(cells):
        im = Image.open(file).convert('RGB')
        if crop:
            im = im.crop(crop)
        im.thumbnail((width, height - 30))
        x, y = i % cols * width, i // cols * height
        sheet.paste(im, (x + (width - im.width) // 2, y + 30))
        draw.text((x + 8, y + 7), label, font=FONT, fill='white')
    sheet.save(dest, quality=92, optimize=True)

for number, ident in enumerate(IDS, 1):
    rows = []
    for folder in sorted((ROOT / 'figures').iterdir()):
        if not (folder / 'receipts.json').exists():
            continue
        receipts = json.loads((folder / 'receipts.json').read_text())
        for pixels in [120, 400]:
            cells = []
            for yaw in [-45, 135]:
                for variant in ['old', 'new']:
                    r = next(r for r in receipts if (r['id'], r['variant'], r['targetPixels'], r['yaw']) == (ident, variant, pixels, yaw))
                    a, b, c, d = r['bounds']
                    im = Image.open(r['file']).convert('RGB').crop((int(a)-12, int(b)-12, int(c)+13, int(d)+13))
                    cells.append((im, f'{variant} {pixels}px {"front" if yaw == -45 else "back"}'))
            width = max(240, max(i.width for i, _ in cells) + 8)
            height = max(i.height for i, _ in cells) + 54
            row = Image.new('RGB', (width * 4, height), BG)
            draw = ImageDraw.Draw(row)
            draw.text((8, 5), folder.name, font=FONT, fill='white')
            for k, (im, label) in enumerate(cells):
                row.paste(im, (width*k+(width-im.width)//2, 52))
                draw.text((width*k+8, 28), label, font=FONT, fill='white')
            rows.append(row)
    width = max(i.width for i in rows)
    sheet = Image.new('RGB', (width, sum(i.height for i in rows)+40), BG)
    ImageDraw.Draw(sheet).text((10, 10), ident+' | game camera, L6 surface light; neutral-light supplement', font=FONT, fill='white')
    y = 40
    for row in rows:
        sheet.paste(row, ((width-row.width)//2, y))
        y += row.height
    sheet.save(OUT / f'{number:02}-{ident}.jpg', quality=92, optimize=True)

if __name__ == '__main__':
    import sys
    if '--runtime' in sys.argv:
        configs = ['low-webgl2', 'high-webgpu', 'high-webgl2', 'low-webgpu']
        grid([(ROOT/f'crowd-{variant}-{config}'/'zoom-1.5.png', f'{config} | {variant} | 30 L6 figures') for config in configs for variant in ['old', 'new']], OUT/'05-crowd-old-new.jpg')
        grid([(ROOT/f'states-{variant}-{config}'/f'{state}.png', f'{config} | {variant} | {state}') for config in ['low-webgl2', 'high-webgpu'] for state in ['live', 'turned', 'corpse'] for variant in ['old', 'new']], OUT/'06-body-states.jpg')
        grid([(ROOT/f'crowd-{variant}-{config}'/f'marcus-{side}.png', f'{config} | {variant} | Marcus pistol {side}') for config in ['low-webgl2', 'high-webgpu'] for side in ['front', 'back'] for variant in ['old', 'new']], OUT/'10-marcus-pistol.jpg')
        names = [p.name for p in (ROOT/'story-new-high-webgpu').iterdir() if p.is_dir()]
        for index, start in enumerate(range(0, len(names), 6), 7):
            cells = []
            for name in sorted(names)[start:start+6]:
                for config in ['low-webgl2', 'high-webgpu']:
                    shots = sorted((ROOT/f'story-new-{config}'/name).glob('shot-*.png'))
                    if shots:
                        cells.append((shots[-1], f'{config} | {name}'))
            if cells:
                grid(cells, OUT/f'{index:02}-scripted-scenes.jpg')
        extra = []
        for config in ['low-webgl2', 'high-webgpu']:
            folder = ROOT/f'beats-new-{config}'
            if folder.exists():
                for scene in sorted(p for p in folder.iterdir() if p.is_dir()):
                    shots = sorted(scene.glob('shot-*.png'))
                    if shots:
                        extra.append((shots[-1], f'{config} | {scene.name}'))
        if extra:
            grid(extra, OUT/'09-retreat-and-hatch.jpg')
        close = []
        for config in ['low-webgl2', 'high-webgpu']:
            for i, ident in enumerate(IDS):
                for state in ['turned', 'corpse']:
                    for variant in ['old', 'new']:
                        close.append((ROOT/f'states-{variant}-{config}'/f'{state}-{i}-close.png', f'{config} | {variant} {state} | {i+1}'))
        grid(close, OUT/'11-turned-corpses-close.jpg', width=400, cols=4, crop=(400, 150, 1200, 850), aspect=.875)
