"""Deterministic transparent 256 px scorch decal (blast/fire aftermath on paving). Run with python3 from any directory."""
from pathlib import Path
import math
import random
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[2] / 'public/assets/decals'
OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(2711)
size = 768
image = Image.new('RGBA', (size, size))
draw = ImageDraw.Draw(image)


def blob(x, y, radius, fill, aspect=1.0, wobble=.18):
    points = []
    phase = rng.random() * math.tau
    for step in range(56):
        angle = step * math.tau / 56
        r = radius * (1 + wobble * math.sin(angle * 4 + phase) + rng.uniform(-.07, .07))
        points.append((x + math.cos(angle) * r, y + math.sin(angle) * r * aspect))
    draw.polygon(points, fill=fill)


# Outer soot halo (brown-black, soft), dense black core, streaks radiating from the centre and ash flecks.
blob(384, 384, 330, (44, 34, 30, 120), .92, .22)
blob(384, 384, 250, (30, 24, 24, 175), .9, .2)
blob(384, 384, 165, (18, 15, 17, 225), .88, .16)
for _ in range(22):
    angle = rng.random() * math.tau
    length = rng.uniform(220, 360)
    width = rng.uniform(10, 26)
    x0, y0 = 384 + math.cos(angle) * 90, 384 + math.sin(angle) * 90
    x1, y1 = 384 + math.cos(angle) * length, 384 + math.sin(angle) * length
    nx, ny = -math.sin(angle) * width, math.cos(angle) * width
    draw.polygon([(x0 + nx, y0 + ny), (x1, y1), (x0 - nx, y0 - ny)], fill=(26, 21, 22, 150))
for _ in range(70):
    angle = rng.random() * math.tau
    distance = rng.uniform(40, 340)
    blob(384 + math.cos(angle) * distance, 384 + math.sin(angle) * distance, rng.uniform(4, 14), (70, 64, 62, 200) if rng.random() < .35 else (16, 14, 15, 210))
image = image.filter(ImageFilter.GaussianBlur(3))
image.resize((256, 256), Image.Resampling.LANCZOS).save(OUT / 'scorch.png', optimize=True)
print('wrote', OUT / 'scorch.png')
