#!/usr/bin/env python3
"""world-fill (PO #34) before/after sheet from tools/qa/world-fill-capture.sh outputs.
usage: world-fill-sheet.py <out.jpg> <before-root> <after-root>
Rows: every world-fill scene. Columns: before WebGPU high z1 / z1.5, after WebGPU high z1 / z1.5, after low z1 / z1.5, after WebGL2 high z1."""
import glob, os, sys
from PIL import Image, ImageDraw
out, before, after = sys.argv[1:4]
names = sorted({os.path.basename(p).split('-z')[0] for p in glob.glob(f'{after}/world-fill-*-z1.0*')})
W, H, LBL = 320, 180, 130
columns = [('before high z1', before, '1.0', '-webgpu'), ('before high z1.5', before, '1.5', '-webgpu'),
           ('after high z1', after, '1.0', '-webgpu'), ('after high z1.5', after, '1.5', '-webgpu'),
           ('after low z1', after, '1.0', '-webgpu-low'), ('after low z1.5', after, '1.5', '-webgpu-low'), ('after webgl2 z1', after, '1.0', '')]
sheet = Image.new('RGB', (LBL + W * len(columns), 22 + H * len(names)), (18, 18, 22)); d = ImageDraw.Draw(sheet)
for j, (label, *_rest) in enumerate(columns): d.text((LBL + j * W + 6, 5), label, fill=(230, 230, 230))
for i, name in enumerate(names):
    d.text((6, 22 + i * H + H // 2 - 6), name.replace('world-fill-', ''), fill=(230, 230, 230))
    for j, (_, root, z, suffix) in enumerate(columns):
        pngs = sorted(glob.glob(f'{root}/{name}-z{z}{suffix}/shot-*.png'))
        if pngs: sheet.paste(Image.open(pngs[-1]).convert('RGB').resize((W, H)), (LBL + j * W, 22 + i * H))
quality = 84
while True:
    sheet.save(out, quality=quality)
    if os.path.getsize(out) <= 700_000 or quality <= 50: break
    quality -= 6
print(out, sheet.size, os.path.getsize(out), 'bytes, q', quality)
