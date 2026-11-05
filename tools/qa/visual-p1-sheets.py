"""Compact, labelled QA sheets from the unmodified capture matrix."""
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

src = Path('test-results/visual-p1-1102/captures')
out = Path('test-results/visual-p1-1102')
out.mkdir(parents=True, exist_ok=True)
rows = json.loads((src / 'matrix.json').read_text())
index = {r['name']: r for r in rows}
groups = {
    'bounds': ['bounds-l7'], 'vehicle': ['vehicle-l2'],
    'canopy': ['canopy-l8'], 'parts': ['parts-l4-bus', 'parts-l4-apc'],
    'mailbox': ['mailbox-l1'], 'benches': ['benches-l2'],
}
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 11)
manifest = []
for sheet, items in groups.items():
    cells = []
    for backend in ['webgl2', 'webgpu']:
        for tier in ['low', 'high']:
            for zoom in [0.5, 1.5]:
                for item in items:
                    for phase in ['before', 'after']:
                        name = f'{item}-{phase}-{backend}-{tier}-z{zoom}'
                        row = index[name]
                        assert not row['errors'], (name, row['errors'])
                        assert row.get('share'), (name, 'visibility measurement missing')
                        path = src / f'{name}.png'
                        image = Image.open(path).convert('RGB')
                        label = f'{phase.upper()} {backend} {tier} z{zoom}'
                        if len(items) > 1:
                            label += ' ' + item.rsplit('-', 1)[1]
                        cells.append((image, label))
                        manifest.append({k: row[k] for k in ['name', 'item', 'phase', 'backend', 'tier', 'zoom', 'revision', 'sourceDiff', 'share'] } | {'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    # Keep an enlarged paired detail inside the same sheet, never a second sheet.
    for item in items:
        for phase in ['before', 'after']:
            name = f'{item}-{phase}-webgpu-high-z1.5'
            image = Image.open(src / f'{name}.png').convert('RGB')
            crop = (430, 185, 670, 350) if sheet == 'benches' else (480, 230, 830, 470)
            cells.append((image.crop(crop), f'DETAIL {phase.upper()} GPU high z1.5'))
    width, height, columns = 320, 200, 4
    sheet_image = Image.new('RGB', (width * columns, height * ((len(cells) + columns - 1) // columns)), '#171b23')
    draw = ImageDraw.Draw(sheet_image)
    for i, (image, label) in enumerate(cells):
        x, y = (i % columns) * width, (i // columns) * height
        image.thumbnail((width - 4, height - 22), Image.Resampling.LANCZOS)
        sheet_image.paste(image, (x + (width - image.width) // 2, y + 20))
        draw.text((x + 4, y + 3), label, font=font, fill='#ffdb83')
    path = out / f'{sheet}.jpg'
    quality = 84
    while True:
        sheet_image.save(path, quality=quality, optimize=True)
        if path.stat().st_size <= 380 * 1024 or quality <= 40:
            break
        quality -= 5
    assert path.stat().st_size <= 380 * 1024, path
    print(f'{path}: {len(cells)} cells, {path.stat().st_size // 1024} KiB')
assert len(manifest) == 112, len(manifest)
(out / 'capture-manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')
