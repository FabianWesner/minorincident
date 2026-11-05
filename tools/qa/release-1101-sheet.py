#!/usr/bin/env python3
"""Release QA 2026-11-01 contact sheet per level: rows = build x tier (cur = main cdaed6356, prod = 793be6bd3),
columns = the five fight frames (time s, zoom) of tools/qa/release-1101-fight.ts. Optional extra row of check frames.
usage: release-1101-sheet.py <level> <out.jpg> [extra.jpg,...]"""
import glob, os, re, sys
from PIL import Image, ImageDraw
level, out = sys.argv[1], sys.argv[2]
extra = [p for p in (sys.argv[3].split(',') if len(sys.argv) > 3 else []) if os.path.exists(p)]
w, h, lab = 320, 180, 16
root = 'test-results/release-qa/fight'
rows = [(b, t) for t in ('low', 'high') for b in ('cur', 'prod')]
def frames(b, t):
    files = glob.glob(f'{root}/{b}-{t}/{level}-t*-z*.jpg')
    return sorted(files, key=lambda p: int(re.search(r'-t(\d+)-', p).group(1)))
n = max([len(frames(b, t)) for b, t in rows] + [len(extra), 1])
height = len(rows) * (h + lab) + (h + lab if extra else 0) + lab
sheet = Image.new('RGB', (n * w, height), (20, 20, 24))
d = ImageDraw.Draw(sheet)
d.text((4, 2), f'{level}  rows: build/tier  cells: t=sim seconds, z=zoom (1.5 wide, 0.5 close)', fill=(230, 230, 230))
y = lab
for b, t in rows:
    for c, p in enumerate(frames(b, t)):
        sheet.paste(Image.open(p).convert('RGB').resize((w, h)), (c * w, y + lab))
        m = re.search(r'-t(\d+)-z([\d.]+)', p)
        d.text((c * w + 4, y + 2), f'{b} {t}  t{m.group(1)} z{m.group(2)}', fill=(255, 210, 120) if b == 'cur' else (150, 200, 255))
    y += h + lab
if extra:
    for c, p in enumerate(extra[:n]):
        sheet.paste(Image.open(p).convert('RGB').resize((w, h)), (c * w, y + lab))
        d.text((c * w + 4, y + 2), os.path.basename(p)[:44], fill=(200, 255, 200))
os.makedirs(os.path.dirname(out), exist_ok=True)
sheet.save(out, quality=80)
print(out, sheet.size)
