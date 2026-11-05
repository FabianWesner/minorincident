"""Archive bounded run ledgers and every reviewed frame on numbered sheets.
Run with a run directory and an evidence label. Raw captures are removed only
after the separate human/agent review has inspected these sheets.
"""
from pathlib import Path
from PIL import Image, ImageDraw
import gzip
import hashlib
import json
import os
import sys

run = Path(sys.argv[1])
label = sys.argv[2]
out = Path(os.environ.get('VQA_EVIDENCE_ROOT', 'test-results/vqa-fix-4'))
review = out / 'review'
evidence = out / 'evidence'
review.mkdir(parents=True, exist_ok=True)
evidence.mkdir(parents=True, exist_ok=True)
sha = lambda data: hashlib.sha256(data).hexdigest()
files = sorted((run / 'captures').glob('*.jpg'), key=lambda p: p.stat().st_mtime_ns)
manifest = []
compact = len(sys.argv) > 3 and sys.argv[3] == 'compact'
columns, count = (3, 12) if compact else (2, 6)
width = 1280 // columns
height = width * 9 // 16
for previous in review.glob(f'{label}-[0-9][0-9].jpg'):
    previous.unlink()
for start in range(0, len(files), count):
    group = files[start:start + count]
    sheet = Image.new('RGB', (1280, (height + 35) * (count // columns)), '#17202b')
    draw = ImageDraw.Draw(sheet)
    target = review / f'{label}-{start // count + 1:02}.jpg'
    for i, path in enumerate(group):
        picture = Image.open(path)
        picture.thumbnail((width, height))
        x, y = i % columns * width, i // columns * (height + 35)
        sheet.paste(picture, (x, y))
        draw.text((x + 6, y + height + 4), path.name[-(68 if compact else 100):], fill='white')
        manifest.append({'source': str(path), 'sha256': sha(path.read_bytes()), 'sheet': str(target), 'cell': i + 1})
    sheet.save(target, quality=90)
for path in run.iterdir():
    if path.is_file() and path.suffix in ('.json', '.jsonl') and 'frames' not in path.name and 'l3l4-threat' not in path.name:
        target = evidence / f'{label}-{path.name}.gz'
        target.write_bytes(gzip.compress(path.read_bytes(), mtime=0))
        manifest.append({'source': str(path), 'sha256': sha(path.read_bytes()), 'archive': str(target), 'archiveSha256': sha(target.read_bytes())})
(review / f'{label}-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps({'label': label, 'frames': len(files), 'sheets': (len(files) + count - 1) // count}))
