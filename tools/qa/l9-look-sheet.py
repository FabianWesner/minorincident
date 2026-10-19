#!/usr/bin/env python3
"""look-l9 sheet: one row per stretch, one column per (root, zoom).
usage: l9-look-sheet.py <out.jpg> <label=root> [<label=root> ...]  [ZOOMS=0.5,1.0,1.5]
Each root holds Scene Lab outputs <root>/l9look-<stretch>-z<zoom>*/shot-*.png (the last PNG of each scene)."""
import glob, os, sys
from PIL import Image, ImageDraw
out, cols = sys.argv[1], [a.split('=', 1) for a in sys.argv[2:]]
zooms = os.environ.get('ZOOMS', '0.5,1.0,1.5').split(',')
W, H = 320, 180
stretches = sorted({os.path.basename(p)[len('l9look-'):].split('-z')[0] for _, root in cols for p in glob.glob(f'{root}/l9look-*')})
columns = [(label, root, z) for label, root in cols for z in zooms]
sheet = Image.new('RGB', (130 + W * len(columns), 22 + H * len(stretches)), (18, 18, 22)); d = ImageDraw.Draw(sheet)
for j, (label, _, z) in enumerate(columns): d.text((130 + j * W + 6, 5), f'{label} z{z}', fill=(230, 230, 230))
for i, name in enumerate(stretches):
    d.text((6, 22 + i * H + H // 2), name, fill=(230, 230, 230))
    for j, (_, root, z) in enumerate(columns):
        pngs = sorted(glob.glob(f'{root}/l9look-{name}-z{z}*/shot-*.png'))
        if pngs: sheet.paste(Image.open(pngs[-1]).convert('RGB').resize((W, H)), (130 + j * W, 22 + i * H))
sheet.save(out, quality=84)
print(out, sheet.size)
