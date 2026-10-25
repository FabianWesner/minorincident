"""Pixel-preserving A/B capture sheets; run with the pipeline Python/Pillow env."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
raw = Path('/private/tmp/tex-infected-readability')
out = Path('docs/reports/tex-infected')
fonts = ['/System/Library/Fonts/Menlo.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
font = next((ImageFont.truetype(p, 16) for p in fonts if Path(p).exists()), ImageFont.load_default())
def label(image, text, at=(0, 0)):
    draw = ImageDraw.Draw(image)
    bounds = draw.textbbox(at, text, font=font)
    draw.rectangle((at[0], at[1], bounds[2]+8, bounds[3]+6), fill='#171717')
    draw.text((at[0]+4, at[1]+2), text, fill='white', font=font)
source = Image.open('/private/tmp/tex-infected-captures/pipeline-look.png').convert('RGB')
for backend in ['webgl2', 'webgpu']:
    for tier in ['low', 'high']:
        sheet = Image.new('RGB', (1280+source.width, 1200), '#222222')
        for row, framing in enumerate(['z1', 'z1.5', 'close']):
            for col, variant in enumerate(['main', 'after']):
                # Native pixels: crop only, no image enlargement or resampling.
                im = Image.open(raw/f'{variant}-{backend}-{tier}-{framing}.png').convert('RGB').crop((320, 160, 960, 560))
                label(im, f'{variant} / {backend} / {tier} / {framing}')
                sheet.paste(im, (col*640, row*400))
        sheet.paste(source, (1280, 0))
        label(sheet, 'PO pipeline reference', (1280, 0))
        label(sheet, 'Game zoom 1 / zoom 1.5 / close', (1280, 420))
        label(sheet, 'Native pixels, cropped only', (1280, 455))
        sheet.save(out/f'compare-{backend}-{tier}.png', optimize=True)
    sheet = Image.new('RGB', (2560, 1440))
    for row, tier in enumerate(['low', 'high']):
        for col, variant in enumerate(['main', 'after']):
            im = Image.open(raw/f'{variant}-{backend}-{tier}-crowd30.png').convert('RGB')
            label(im, f'{variant} / {backend} / {tier} / 30 infected, 10 workers')
            sheet.paste(im, (col*1280, row*720))
    sheet.save(out/f'crowd30-{backend}.png', optimize=True)
trial = Path('/private/tmp/tex-suit-solidify')
if (trial/'source.png').exists():
    sheet = Image.new('RGB', (2048, 640))
    for col, (file, text) in enumerate([('source', 'Approved source, 35,990 triangles'), ('current_5700', 'Current LOD0, 5,700 triangles'), ('suit_5700', 'Envelope: mouth/eye sockets filled'), ('winding_5700', 'Winding: reduced fingers/face detail')]):
        im = Image.open(trial/f'{file}.png').convert('RGB'); label(im, text); sheet.paste(im, (512*col, 0))
    sheet.save(out/'solidify-trial.png', optimize=True)
