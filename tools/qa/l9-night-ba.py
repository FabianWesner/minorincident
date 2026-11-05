#!/usr/bin/env python3
"""l9-night-look before/after sheet: rows = stations, columns = (before, after) pairs per zoom of one backend/tier combo.
usage: l9-night-ba.py <before_dir> <after_dir> <out.jpg> [zooms=1,1.5] [cell_width=400]"""
import os, sys
from PIL import Image, ImageDraw
before, after, outp = sys.argv[1:4]
zooms = (sys.argv[4] if len(sys.argv) > 4 else '1,1.5').split(',')
w = int(sys.argv[5]) if len(sys.argv) > 5 else 400
h = w * 9 // 16
rows = sorted({f.split('-z')[0] for f in os.listdir(after) if f.endswith('.png')})
cols = [(z, d, tag) for z in zooms for d, tag in ((before, 'PROD'), (after, 'after'))]
sheet = Image.new('RGB', (w * len(cols), h * len(rows)), 'black')
draw = ImageDraw.Draw(sheet)
for r, row in enumerate(rows):
    for c, (z, d, tag) in enumerate(cols):
        p = f'{d}/{row}-z{z}.png'
        if os.path.exists(p):
            sheet.paste(Image.open(p).convert('RGB').resize((w, h)), (c * w, r * h))
        draw.text((c * w + 6, r * h + 4), f'{tag} {row} z{z}', fill='yellow')
sheet.save(outp, quality=82)
print(outp, sheet.size)
