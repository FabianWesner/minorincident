"""Retain original-size, labelled two-frame sheets and hashes before raw cleanup."""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

run = Path(sys.argv[1])
dest = Path('test-results/fix53-a/reviewed')
dest.mkdir(parents=True, exist_ok=True)
files = sorted((p for p in (run / 'captures').glob('*') if p.suffix in {'.jpg', '.png'}), key=lambda p: p.stat().st_mtime_ns)
photos = []
for offset in range(0, len(files), 2):
    pair = files[offset:offset + 2]
    sheet = Image.new('RGB', (1280, len(pair) * 748), '#172029')
    draw = ImageDraw.Draw(sheet)
    name = f'{run.name}-{offset // 2 + 1:02}.jpg'
    for cell, file in enumerate(pair):
        picture = Image.open(file).convert('RGB')
        assert picture.size == (1280, 720), picture.size
        draw.text((8, cell * 748 + 7), file.name, fill='white')
        sheet.paste(picture, (0, cell * 748 + 28))
        photos.append({'original': str(file), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
                       'sheet': str(dest / name), 'cell': cell + 1, 'originalPixels': [1280, 720]})
    sheet.save(dest / name, quality=88, subsampling=0)
for photo in photos:
    photo['sheetSha256'] = hashlib.sha256(Path(photo['sheet']).read_bytes()).hexdigest()
manifest = {'run': str(run), 'method': 'Two original-size 1280x720 frames per labelled sheet; JPEG re-encoding only; no scaling or crop', 'photos': photos}
Path('docs/reports/fix53-a').mkdir(parents=True, exist_ok=True)
Path(f'docs/reports/fix53-a/{run.name}-photos.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'{len(files)} frames / {(len(files)+1)//2} sheets')
