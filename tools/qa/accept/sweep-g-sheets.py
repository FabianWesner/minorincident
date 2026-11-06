"""Hash each completed route's captures and prepare labelled review sheets.

Review observations are added explicitly after opening every sheet.
"""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw

run = Path(sys.argv[1])
name = run.parent.name + '-' + run.name if run.name.startswith('batch') else run.name
dest = Path('test-results/sweep-g/review') / name
dest.mkdir(parents=True, exist_ok=True)
files = sorted((run / 'captures').glob('*.jpg') if (run / 'captures').exists() else run.glob('*.png'), key=lambda p: p.stat().st_mtime_ns)
rows = []
for offset in range(0, len(files), 4):
    sheet = Image.new('RGB', (1280, 772), '#172029')
    draw = ImageDraw.Draw(sheet)
    path = dest / f'sheet-{offset // 4 + 1:02}.jpg'
    for index, file in enumerate(files[offset:offset + 4]):
        x, y = index % 2 * 640, index // 2 * 386
        picture = Image.open(file).convert('RGB')
        draw.text((x + 4, y + 5), file.name, fill='white')
        sheet.paste(picture.resize((640, 360)), (x, y + 26))
        rows.append({'file': str(file), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
                     'sheet': str(path), 'cell': index + 1, 'originalPixels': list(picture.size),
                     'reviewed': False})
    sheet.save(path, quality=90, subsampling=0)
for row in rows:
    row['sheetSha256'] = hashlib.sha256(Path(row['sheet']).read_bytes()).hexdigest()
Path(f'docs/reports/sweep-g/{name}-captures.json').write_text(json.dumps(rows, indent=2) + '\n')
print(f'{len(files)} captures / {(len(files) + 3) // 4} sheets: {dest}')
