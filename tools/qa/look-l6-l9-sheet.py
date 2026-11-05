#!/usr/bin/env python3
"""look-l6-l9 contact sheet: rows = regions, columns = <tag> x tier x zoom (WebGPU), from test-results/look/<tag>-<tier>-webgpu.
usage: look-l6-l9-sheet.py <out.jpg> <level l6|l9> <tag[,tag2]> [cell_width=320]"""
import os, sys
from PIL import Image, ImageDraw
out, level, tags = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
w = int(sys.argv[4]) if len(sys.argv) > 4 else 320
h = w * 9 // 16
root = 'test-results/look'
regions = {'l6': ['shelter', 'tunnel-west', 'tunnel-mid', 'tunnel-east', 'exit-platform', 'street'],
           'l9': ['fork', 'road-diagonal', 'road-hazard', 'dry-flares', 'countryside-farm', 'crash-approach']}[level]
cols = [(t, tier, z) for t in tags for tier in (os.environ.get('TIERS', 'high,low').split(',')) for z in ('1.0', '1.5')]
lab = 18
sheet = Image.new('RGB', (len(cols) * w, len(regions) * (h + lab) + lab), (20, 20, 24))
d = ImageDraw.Draw(sheet)
for c, (t, tier, z) in enumerate(cols): d.text((c * w + 4, 3), f'{t} {tier} z{z}', fill=(230, 230, 230))
for r, name in enumerate(regions):
    y = lab + r * (h + lab)
    d.text((4, y + 3), name, fill=(255, 210, 120))
    for c, (t, tier, z) in enumerate(cols):
        p = f'{root}/{t}-{tier}-webgpu/{level}look-{name}-z{z}-webgpu' + ('-low' if tier == 'low' else '') + '/shot-0149.png'
        if os.path.exists(p): sheet.paste(Image.open(p).convert('RGB').resize((w, h)), (c * w, y + lab))
sheet.save(out, quality=82)
print(out, sheet.size)
