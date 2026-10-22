#!/usr/bin/env python3
"""Assemble labelled evidence without changing input pixels; retain source SHA256s."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image, ImageDraw
p = argparse.ArgumentParser()
p.add_argument('output'); p.add_argument('inputs', nargs='+'); p.add_argument('--columns', type=int, default=4)
p.add_argument('--cell-height', type=int, default=450)
p.add_argument('--cell-width', type=int, default=400)
p.add_argument('--scenelab-first', action='store_true', help='Use the first 320x180 cell of a 16:9 Scene Lab sheet')
a = p.parse_args(); width, height, label = a.cell_width, a.cell_height, 35
sheet = Image.new('RGB', (width * a.columns, (height + label) * ((len(a.inputs) + a.columns - 1) // a.columns)), '#101722')
draw = ImageDraw.Draw(sheet); sources = []
for i, entry in enumerate(a.inputs):
    title, filename = entry.split('=', 1); path = Path(filename)
    image = Image.open(path).convert('RGB')
    if a.scenelab_first: image = image.crop((0, 0, 320, 180))
    image.thumbnail((width, height))
    x, y = i % a.columns * width, i // a.columns * (height + label)
    sheet.paste(image, (x + (width - image.width) // 2, y + (height - image.height) // 2))
    draw.text((x + 5, y + height + 5), title, fill='white')
    sources.append({'label': title, 'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'crop': [0, 0, 320, 180] if a.scenelab_first else None})
sheet.save(a.output, quality=92)
Path(a.output).with_suffix('.sources.json').write_text(json.dumps(sources, indent=2) + '\n')
