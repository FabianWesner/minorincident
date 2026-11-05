"""Retain unscaled capture sheets and exact input archives for manual inspection."""
import hashlib
import json
import sys
from pathlib import Path
import gzip
from PIL import Image, ImageDraw, UnidentifiedImageError

input_path, review_dir = Path(sys.argv[1]), Path(sys.argv[2])
kind = sys.argv[3] if len(sys.argv) > 3 else 'late-input'
receipt = json.loads(input_path.read_text())
run = Path(receipt['out'])
dest = Path(sys.argv[4] if len(sys.argv) > 4 else 'test-results/fix55-c') / run.name
dest.mkdir(parents=True, exist_ok=True)
review_dir.mkdir(parents=True, exist_ok=True)
sha = lambda data: hashlib.sha256(data).hexdigest()
photos, sheets, artifacts, unreadable = [], [], [], []
files = sorted(p for p in (run / 'captures').glob('*') if p.suffix in {'.png', '.jpg'})
valid_files = []
for file in files:
    try:
        with Image.open(file) as picture:
            picture.verify()
        valid_files.append(file)
    except (UnidentifiedImageError, OSError) as error:
        unreadable.append({'file': str(file), 'sha256': sha(file.read_bytes()), 'error': str(error),
                           'seen': 'Unreadable capture; excluded from qualifying visual evidence.'})
files = valid_files
for offset in range(0, len(files), 4):
    group = files[offset:offset+4]
    sheet = Image.new('RGB', (2560, 748*((len(group)+1)//2)), '#172029')
    draw = ImageDraw.Draw(sheet)
    name = dest / f'sheet-{offset//4+1:02}.jpg'
    for cell, file in enumerate(group):
        picture = Image.open(file).convert('RGB')
        assert picture.size == (1280,720), picture.size
        x, y = cell%2*1280, cell//2*748
        draw.text((x+8,y+7),file.name,fill='white')
        sheet.paste(picture,(x,y+28))
        photos.append({'file':file.name if kind == 'dog-look' else str(file),'original':str(file),'sha256':sha(file.read_bytes()),'sheet':str(name),'cell':cell+1,'seen':''})
    sheet.save(name,quality=90,subsampling=0)
    sheets.append({'file':str(name),'sha256':sha(name.read_bytes())})
for name in [f'log-{kind}.jsonl',f'{kind}-completion.json',f'handover-audit-{kind}.json',f'{kind}-acceptance-ledger.json',f'{kind}-audio.json',f'issues-{kind}.json',f'runs-{kind}.json']:
    file = run / name
    if not file.exists():
        continue
    raw = file.read_bytes()
    target = review_dir / (name+'.gz')
    target.write_bytes(gzip.compress(raw,mtime=0))
    artifacts.append({'file':str(target),'sha256':sha(target.read_bytes()),'uncompressedSha256':sha(raw)})
review = {key:receipt[key] for key in ['sourceHash','browserHash','toolSha256']}
if kind == 'dog-look':
    review.update({'tier':receipt['tier'],'zoom':receipt['zoom']})
review.update({'input':str(input_path),'inputSha256':sha(input_path.read_bytes()),'run':str(run),
               'method':'Four labelled original-size1280x720 frames per sheet; no scaling or crop. Each capture requires a manual seen note before admission.',
               'captures':photos,'sheets':sheets,'artifacts':artifacts,'unreadableCaptures':unreadable})
(review_dir/'review.json').write_text(json.dumps(review,indent=2)+'\n')
print(f'{len(photos)} captures / {len(sheets)} sheets in {dest}; manual notes pending')
