"""Deterministic, transparent 256px blood decals. Run with python3 from any directory."""
from pathlib import Path
import math
import random
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[2] / 'public/assets/decals'
OUT.mkdir(parents=True, exist_ok=True)
for index, kind in enumerate(('splats', 'pool', 'trail')):
    rng = random.Random(1900 + index)
    image = Image.new('RGBA', (768, 768))
    draw = ImageDraw.Draw(image)
    def blob(x, y, radius, aspect=1):
        points = []
        for step in range(48):
            angle = step * math.tau / 48
            r = radius * (1 + .08 * math.sin(angle * 5 + index) + rng.uniform(-.04, .04))
            points.append((x + math.cos(angle) * r, y + math.sin(angle) * r * aspect))
        draw.polygon(points, fill=(112, 16, 29, 235))
        draw.ellipse((x-radius*.55, y-radius*.35*aspect, x+radius*.35, y+radius*.25*aspect), fill=(134, 22, 35, 240))
    if kind == 'pool':
        blob(384, 384, 300, .8)
        for _ in range(8):
            angle = rng.random() * math.tau
            blob(384 + math.cos(angle)*280, 384 + math.sin(angle)*220, rng.uniform(15, 40))
    elif kind == 'splats':
        blob(384, 384, 205)
        for _ in range(28):
            angle = rng.random() * math.tau
            distance = rng.uniform(190, 320)
            blob(384 + math.cos(angle)*distance, 384 + math.sin(angle)*distance, rng.uniform(8, 40))
    else:
        for step in range(8):
            blob(375 + rng.uniform(-70, 70), 75 + step*86, rng.uniform(32, 62), .65)
        for _ in range(16):
            blob(rng.uniform(240, 500), rng.uniform(50, 720), rng.uniform(4, 15))
    image.resize((256, 256), Image.Resampling.LANCZOS).save(OUT / f'blood-{kind}.png', optimize=True)
