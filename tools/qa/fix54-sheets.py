"""Keep labelled unscaled captures and SHA-256 receipts before owned raw cleanup."""
import hashlib, json, sys
from pathlib import Path
from PIL import Image, ImageDraw
run = Path(sys.argv[1])
report = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('docs/reports/fix54-a')
report.mkdir(parents=True, exist_ok=True)
dest = Path('test-results') / report.name / 'reviewed'
dest.mkdir(parents=True, exist_ok=True)
files = sorted(p for p in (run / 'captures').glob('*') if p.suffix in {'.png', '.jpg'})
photos = []
for offset in range(0, len(files), 4):
    group = files[offset:offset+4]
    sheet = Image.new('RGB', (2560, 748*((len(group)+1)//2)), '#172029')
    draw = ImageDraw.Draw(sheet)
    name = dest / f'{run.name}-{offset//4+1:02}.jpg'
    for cell, file in enumerate(group):
        picture = Image.open(file).convert('RGB')
        assert picture.size == (1280, 720)
        x, y = cell%2*1280, cell//2*748
        draw.text((x+8, y+7), file.name, fill='white')
        sheet.paste(picture, (x, y+28))
        photos.append({'raw': str(file), 'sha256': hashlib.sha256(file.read_bytes()).hexdigest(), 'sheet': str(name), 'cell': cell+1})
    sheet.save(name, quality=90, subsampling=0)
for photo in photos:
    photo['sheetSha256'] = hashlib.sha256(Path(photo['sheet']).read_bytes()).hexdigest()
(report / f'{run.name}-photos.json').write_text(json.dumps({'method': 'Four labelled original-size 1280x720 images per sheet; no scaling or cropping', 'photos': photos}, indent=2)+'\n')
print(run, len(photos))
