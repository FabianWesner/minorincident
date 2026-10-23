#!/usr/bin/env python3
"""l9-night-look contact sheet: rows = stations, columns = zooms from one l9-night-capture.ts output dir.
usage: l9-night-sheet.py <dir> <out.jpg> [cell_width=480]"""
import os, sys
from PIL import Image, ImageDraw
d, outp = sys.argv[1], sys.argv[2]
w = int(sys.argv[3]) if len(sys.argv) > 3 else 480
files = sorted(f for f in os.listdir(d) if f.endswith('.png'))
rows = sorted({f.split('-z')[0] for f in files})
cols = sorted({f.split('-z')[1][:-4] for f in files}, key=float)
h = w * 9 // 16
sheet = Image.new('RGB', (w * len(cols), h * len(rows)), 'black')
draw = ImageDraw.Draw(sheet)
for r, row in enumerate(rows):
    for c, col in enumerate(cols):
        p = f'{d}/{row}-z{col}.png'
        if os.path.exists(p):
            sheet.paste(Image.open(p).convert('RGB').resize((w, h)), (c * w, r * h))
        draw.text((c * w + 6, r * h + 4), f'{row} z{col}', fill='yellow')
sheet.save(outp, quality=85)
print(outp, sheet.size)
