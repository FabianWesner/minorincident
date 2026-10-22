"""Keep the 24 native views in four before/after contact sheets, without rescaling."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path('test-results/fixes-13h-l10/accepted-real-time-matrix')
out = Path('docs/reports/fixes-13h-l10')
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 19)
for backend in ['webgl2', 'webgpu']:
    for tier in ['low', 'high']:
        sheet = Image.new('RGB', (3840, 1504), '#111820')
        draw = ImageDraw.Draw(sheet)
        for row, stage in enumerate(['before', 'after']):
            for col, zoom in enumerate(['0.5', '1', '1.5']):
                native = Image.open(root / f'{backend}-{stage}-{tier}' / f'z{zoom}.jpg')
                assert native.size == (1280, 720)
                x, y = col * 1280, row * 752
                draw.text((x + 12, y + 5), f'{backend} | {tier} | zoom {zoom} | {stage}', font=font, fill='white')
                sheet.paste(native, (x, y + 32))
        sheet.save(out / f'corpses-{backend}-{tier}.jpg', quality=94, subsampling=0)
