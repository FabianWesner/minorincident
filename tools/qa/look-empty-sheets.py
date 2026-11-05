"""Before/after game-camera sheets, both tiers and zooms, five stops per sheet."""
import json
from pathlib import Path
from PIL import Image, ImageDraw

root = Path('test-results/look-empty')
out = root / 'sheets'
out.mkdir(exist_ok=True)
evidence = []
for tier in ('high', 'low'):
    rows = json.loads((root / 'after' / f'evidence-{tier}.json').read_text())
    for level in ('L6', 'L7', 'L10'):
        stops = list(dict.fromkeys((r['x'], r['z']) for r in rows if r['level'] == level and r['tier'] == tier))
        for page, start in enumerate(range(0, len(stops), 5), 1):
            group = stops[start:start + 5]
            w, h, label = 480, 270, 26
            image = Image.new('RGB', (w * 4, label + len(group) * (h + label)), '#14171c')
            d = ImageDraw.Draw(image)
            for col, text in enumerate(('BEFORE / zoom 1', 'AFTER / zoom 1', 'BEFORE / zoom 1.5', 'AFTER / zoom 1.5')):
                d.text((col * w + 8, 6), f'{level} {tier} / {text}', fill='white')
            for row, (x, z) in enumerate(group):
                for col, (phase, zoom) in enumerate((('before', 1), ('after', 1), ('before', 1.5), ('after', 1.5))):
                    path = root / phase / f'{level}-{tier}-{x}-{z}-z{zoom}.png'
                    shot = Image.open(path).convert('RGB').resize((w, h), Image.Resampling.LANCZOS)
                    y = label + row * (h + label)
                    d.text((col * w + 8, y + 5), f'x={x}, z={z}', fill='#ffe18a')
                    image.paste(shot, (col * w, y + label))
            file = out / f'{level}-{tier}-{page}.jpg'
            image.save(file, quality=90)
            evidence.append(str(file))
print('\n'.join(evidence))
