"""Labelled before/after comparison from the native game-camera captures."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path('test-results/r15-flamevfx')
target = Path('docs/reports/r15-flamevfx/compare.jpg')
font_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
title = ImageFont.truetype(font_path, 28)
label = ImageFont.truetype(font_path, 19)
small = ImageFont.truetype(font_path, 15)
sheet = Image.new('RGB', (1600, 700), '#211f28')
draw = ImageDraw.Draw(sheet)
draw.text((20, 14), 'R15 · Flamethrower continuous jet', font=title, fill='#ffd166')
draw.text((20, 50), 'Same game-camera pose · original vs current firing · high and low quality', font=small, fill='#ddd5cf')
for row, tier in enumerate(('high', 'low')):
    y = 86 + row * 300
    draw.text((20, y), f'{tier.upper()} QUALITY', font=label, fill='#ffd166')
    for col, zoom in enumerate((1, 1.5)):
        x = 20 + col * 790
        for phase, dx in (('before', 0), ('after', 395)):
            image = Image.open(root / f'{tier}-z{zoom}-{phase}.png').convert('RGB')
            image = image.crop((490, 180, 1270, 690)).resize((385, 252), Image.Resampling.LANCZOS)
            sheet.paste(image, (x + dx, y + 30))
            draw.text((x + dx + 5, y + 34), f'zoom {zoom} · {phase}', font=small, fill='#fff6e7', stroke_width=2, stroke_fill='#211f28')
target.parent.mkdir(parents=True, exist_ok=True)
sheet.save(target, quality=88, optimize=True)
print(f'{target}: {target.stat().st_size / 1024:.1f} KiB')

# Supplementary frozen light toggle and actual moving/turning screenshots.
import json
if (root / 'high-night-on.png').exists():
    runtime = Image.new('RGB', (1300, 800), '#211f28')
    rd = ImageDraw.Draw(runtime)
    rd.text((15, 12), 'R15 · Night spill and moving nozzle', font=title, fill='#ffd166')
    cells = [('high-night-on', 'High · one flickering stream light'), ('high-night-off', 'High · same frozen pose, stream light off'),
             ('high-moving-turn', 'High · actual movement and target turn'), ('low-moving-turn', 'Low · actual movement and target turn')]
    for i, (name, caption) in enumerate(cells):
        x, y = 5 + (i % 2) * 650, 60 + (i // 2) * 370
        runtime.paste(Image.open(root / f'{name}.png').convert('RGB').resize((640, 360), Image.Resampling.LANCZOS), (x, y))
        rd.text((x + 8, y + 8), caption, font=small, fill='#fff6e7', stroke_width=2, stroke_fill='#211f28')
    runtime.save(target.with_name('runtime.jpg'), quality=88, optimize=True)
    spill = []
    for tier in ('high', 'low'):
        on = Image.open(root / f'{tier}-night-on.png').convert('RGB')
        off = Image.open(root / f'{tier}-night-off.png').convert('RGB')
        for actor, box in [('courier', (624, 268, 650, 343)), ('target', (1012, 505, 1044, 560))]:
            # These fixed body rectangles include edge/background pixels; they are not identity masks.
            diffs = [sum((a - b) * w for a, b, w in zip(p, q, (.2126, .7152, .0722)))
                     for p, q in zip(on.crop(box).getdata(), off.crop(box).getdata())]
            spill.append({'tier': tier, 'actor': actor, 'rectangle': box, 'mean8BitLumaAdded': sum(diffs) / len(diffs)})
    target.with_name('light-spill.json').write_text(json.dumps({'method': 'Same frozen pose, only the one transient light disabled. Mean signed luminance change in fixed body rectangles, including their edge/background pixels.', 'rows': spill}, indent=2) + '\n')
