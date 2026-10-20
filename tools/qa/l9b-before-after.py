#!/usr/bin/env python3
"""look-l9b before/after sheet: the look-l9 cells (docs/reports/look-l9/sheet-*.jpg, WebGPU high, zoom 1) next to the new captures.
usage: l9b-before-after.py <out.jpg> <after-high-root> <after-low-root> [<webgl2-high-root>]
Rows: fork, road-diagonal, dry-flares, countryside-farm, crash-approach, city-edge. Columns: before (look-l9 high z1),
after high z1 / z1.5, after low z1 / z1.5, after WebGL2 high z1 (when given)."""
import glob, os, sys
from PIL import Image, ImageDraw
out, high, low = sys.argv[1:4]
gl = sys.argv[4] if len(sys.argv) > 4 else None
# look-l9 sheets: three 520x293 cells per row, rows at y 46 and 359 (WebGPU high is the first column).
before = {'fork': ('sheet-route-start', 0), 'road-diagonal': ('sheet-route-start', 1), 'dry-flares': ('sheet-mid-drive', 0),
          'countryside-farm': ('sheet-mid-drive', 1), 'crash-approach': ('sheet-burning-city', 0), 'city-edge': ('sheet-burning-city', 1)}
W, H, LBL = 320, 180, 150
columns = [('before (look-l9)', None, None)] + [(f'after {t} z{z}', root, z) for t, root in (('high', high), ('low', low)) for z in ('1.0', '1.5')]
if gl: columns.append(('after webgl2 z1.0', gl, '1.0'))
sheet = Image.new('RGB', (LBL + W * len(columns), 22 + H * len(before)), (18, 18, 22)); d = ImageDraw.Draw(sheet)
for j, (label, _, _) in enumerate(columns): d.text((LBL + j * W + 6, 5), label, fill=(230, 230, 230))
for i, (name, (file, row)) in enumerate(before.items()):
    d.text((6, 22 + i * H + H // 2 - 6), name, fill=(230, 230, 230))
    if name == 'city-edge': d.text((6, 22 + i * H + H // 2 + 8), '(before: old viewpoint)', fill=(160, 160, 160))
    y = 46 if row == 0 else 359
    cell = Image.open(f'docs/reports/look-l9/{file}.jpg').crop((0, y, 520, y + 293)).resize((W, H))
    sheet.paste(cell, (LBL, 22 + i * H))
    for j, (_, root, z) in enumerate(columns[1:], 1):
        pngs = sorted(glob.glob(f'{root}/l9look-{name}-z{z}*/shot-*.png'))
        if pngs: sheet.paste(Image.open(pngs[-1]).convert('RGB').resize((W, H)), (LBL + j * W, 22 + i * H))
quality = 84
while True:
    sheet.save(out, quality=quality)
    if os.path.getsize(out) <= 400_000 or quality <= 50: break
    quality -= 6
print(out, sheet.size, os.path.getsize(out), 'bytes, q', quality)
