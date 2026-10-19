#!/usr/bin/env python3
"""look-l9 sheet: rows = stretches x zoom, columns = the given capture roots (e.g. before-high, after-high, after-low).
usage: l9-look-sheet.py <out.jpg> <label=root> [<label=root> ...]
Each root holds Scene Lab outputs <root>/l9look-<stretch>-z<zoom>*/<shot>.png (the last PNG of the scene)."""
import glob, os, sys
from PIL import Image, ImageDraw
out, cols = sys.argv[1], [a.split('=', 1) for a in sys.argv[2:]]
W, H = 400, 225
names = sorted({os.path.basename(p).split('-z')[0] + '-z' + os.path.basename(p).split('-z')[1].split('-')[0] for _, root in cols for p in glob.glob(f'{root}/l9look-*')})
sheet = Image.new('RGB', (160 + W * len(cols), 24 + H * len(names)), (18, 18, 22)); d = ImageDraw.Draw(sheet)
for j, (label, _) in enumerate(cols): d.text((160 + j * W + 6, 6), label, fill=(230, 230, 230))
for i, name in enumerate(names):
    d.text((6, 24 + i * H + H // 2), name.removeprefix('l9look-'), fill=(230, 230, 230))
    for j, (_, root) in enumerate(cols):
        dirs = sorted(glob.glob(f'{root}/{name}*'))
        pngs = sorted(glob.glob(f'{dirs[0]}/*.png')) if dirs else []
        if pngs: sheet.paste(Image.open(pngs[-1]).convert('RGB').resize((W, H)), (160 + j * W, 24 + i * H))
sheet.save(out, quality=82)
print(out, sheet.size)
