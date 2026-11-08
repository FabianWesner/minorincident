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
