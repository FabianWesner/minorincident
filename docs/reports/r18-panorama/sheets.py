"""One compact visual sheet, preserving full-frame crops and screenshot provenance."""
import gzip
import hashlib
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).parent
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 13)
title = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 17)
selected = []
for tier in ['low', 'high']:
    for backend in ['webgl2', 'webgpu']:
        for aspect in ['landscape', 'portrait']:
            record = json.loads(gzip.open(root / f'{tier}-{backend}-{aspect}.json.gz').read())
            for label in ['ending-55s', 'ending-65s']:
                capture = next(c for c in record['captures'] if c['label'] == label)
                selected.append((record, capture))
width, height, columns = 384, 258, 4
canvas = Image.new('RGB', (width * columns, 36 + height * 4), '#172029')
draw = ImageDraw.Draw(canvas)
draw.text((10, 9), 'R18 L10 — dry countryside, dawn horizon, spreading green dust; production ending', font=title, fill='white')
provenance = []
for i, (record, capture) in enumerate(selected):
    x, y = i % columns * width, 36 + i // columns * height
    path = Path(capture['file'])
    assert hashlib.sha256(path.read_bytes()).hexdigest() == capture['sha256']
    photo = Image.open(path).convert('RGB')
    photo.thumbnail((width, 216), Image.Resampling.LANCZOS)
    canvas.paste(photo, (x + (width - photo.width) // 2, y))
    state = capture['state']
    draw.text((x + 5, y + 218), f"{record['tier']} {record['backend']} {record['aspect']} · {capture['label']}", font=font, fill='white')
    draw.text((x + 5, y + 236), f"{state['draws']} draws · {state['triangles']:,} tris · HUD {len(state['hud'])}", font=font, fill='#b8c9bf')
    provenance.append({'tag': record['tag'], **capture})
path = root / 'panorama.jpg'
canvas.save(path, quality=86, optimize=True)
(root / 'sheet.json').write_text(json.dumps({'sheet': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'method': 'Full-frame thumbnails, no crop; 55 s wave and 65 s complete footprint/title for every tier/backend/aspect.', 'cells': provenance}, indent=2) + '\n')
print(f'{path}: {path.stat().st_size:,} bytes, {len(selected)} full-frame cells')
