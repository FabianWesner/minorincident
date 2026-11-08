"""Compact proof sheet from unaltered runtime captures; crops/scales are labelled."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

source = Path('test-results/r15-flamer')
target = Path('docs/reports/r15-flamer/sheet.jpg')
sheet = Image.new('RGB', (1600, 1000), '#211f28')
draw = ImageDraw.Draw(sheet)
font_path = '/System/Library/Fonts/Supplemental/Arial.ttf'
title = ImageFont.truetype(font_path, 29)
label = ImageFont.truetype(font_path, 21)
small = ImageFont.truetype(font_path, 16)
draw.text((20, 16), 'R15 · Prototype flamethrower', font=title, fill='#ffd166')
draw.text((20, 53), 'Dedicated model + HUD icon · authored fuel cylinder, hose, two grips and pilot-light nozzle', font=small, fill='#ddd5cf')
sheet.paste(Image.open(source / 'icon.png').convert('RGB').resize((64, 64)), (1516, 10))
for lod, triangles in enumerate((1258, 476, 188)):
    x = 16 + lod * 528
    sheet.paste(Image.open(source / f'lod{lod}.png').convert('RGB').resize((512, 288), Image.Resampling.LANCZOS), (x, 90))
    draw.text((x + 8, 385), f'LOD{lod} · {triangles:,} tris', font=label, fill='#ffd166')
for index, zoom in enumerate(('1', '1.5')):
    x = 16 + index * 788
    fire = Image.open(source / f'zoom-{zoom}-fire.png').convert('RGB')
    # Identical native-pixel crop for both zooms preserves their relative scale.
    sheet.paste(fire.crop((490, 180, 1270, 690)), (x, 433))
    draw.text((x + 10, 440), f'Game zoom {zoom} · firing, frame 45', font=label, fill='#fff6e7', stroke_width=2, stroke_fill='#211f28')
    hold = Image.open(source / f'zoom-{zoom}-hold.png').convert('RGB').crop((588, 235, 708, 400))
    hold = hold.resize((180, 247), Image.Resampling.LANCZOS)
    sheet.paste(hold, (x + 582, 492))
    draw.rectangle((x + 580, 490, x + 763, 740), outline='#ffd166', width=2)
    draw.text((x + 584, 470), 'Hold detail ×1.5', font=small, fill='#fff6e7', stroke_width=1, stroke_fill='#211f28')
draw.text((20, 960), 'Runtime GLBs in the game renderer · headless Metal WebGL2 · game views are identical 780×510 courier/fire crops', font=small, fill='#ddd5cf')
target.parent.mkdir(parents=True, exist_ok=True)
sheet.save(target, quality=88, optimize=True)
print(f'{target}: {target.stat().st_size / 1024:.1f} KiB')
