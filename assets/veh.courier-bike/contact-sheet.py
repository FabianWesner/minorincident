"""Compose compact review sheets from the CPU Cycles renders (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent

def sheet(output, files, labels, rows):
    canvas = Image.new('RGB', (1440, rows * 384), '#211e29')
    draw = ImageDraw.Draw(canvas)
    for i, (file, label) in enumerate(zip(files, labels)):
        x, y = i % 3 * 480, i // 3 * 384
        canvas.paste(Image.open(HERE / 'renders' / file).convert('RGB'), (x, y))
        draw.text((x + 12, y + 363), label, fill='white')
    canvas = canvas.resize((1080, rows * 288), Image.Resampling.LANCZOS)
    canvas.quantize(colors=256).save(HERE / output, optimize=True)

sheet('contact-sheet.png', ['hero.png', 'turntable-quarter-front.png',
    'turntable-quarter-back.png', 'turntable-quarter-rear.png', 'turntable-side.png'],
    ['Front left', 'Front right', 'Rear right', 'Rear left', 'Side (+X forward)'], 2)
sheet('contact-sheet-lods.png', ['turntable-side.png', 'lod1-side.png', 'lod2-side.png'],
    ['LOD0 — authored geometry', 'LOD1 — authored geometry', 'LOD2 — authored geometry'], 1)
