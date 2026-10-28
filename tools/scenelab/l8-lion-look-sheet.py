"""Old/new infected lion + gorilla, living and frozen corpse, like the batch-25 QA sheet (top old, bottom new)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path('test-results/l8-all-new'); OUT = Path('docs/reports/l8-lion-look'); OUT.mkdir(parents=True, exist_ok=True)
FONT = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 14); BG = '#23232d'
CROP = (540, 190, 1060, 710); CELL = 400
# states mode indexes ids as amb.lion, inf.lion, amb.gorilla, inf.gorilla, ...
SUBJECTS = [(1, 'inf.lion'), (3, 'inf.gorilla')]
for config in ['high-webgl2', 'low-webgpu', 'low-webgl2', 'high-webgpu']:
    cells = [[(ROOT / f'states-{v}-{config}/{i}-{shot}.png', f'{v} {ident} {"living" if shot == "idle" else "corpse"}') for i, ident in SUBJECTS for shot in ['idle', 'corpse']] for v in ['old', 'new']]
    if not all(f.exists() for row in cells for f, _ in row): continue
    im = Image.new('RGB', (CELL * 4, (CELL + 24) * 2 + 24), BG); d = ImageDraw.Draw(im)
    d.text((6, 4), f'L8 infected lion/gorilla | {config} | zoom 0.6 game camera | top batch 24 (old), bottom this lane (new)', font=FONT, fill='white')
    for r, row in enumerate(cells):
        for c, (file, label) in enumerate(row):
            pic = Image.open(file).convert('RGB').crop(CROP).resize((CELL, CELL), Image.Resampling.LANCZOS)
            x, y = c * CELL, 24 + r * (CELL + 24); im.paste(pic, (x, y + 24)); d.text((x + 6, y + 4), label, font=FONT, fill='white')
    im.save(OUT / f'lion-gorilla-old-new-{config}.jpg', quality=90, optimize=True)
