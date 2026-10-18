"""Atmosphere 2: one page per level, before | after, rows high zoom 1 and low zoom 0.5 (game camera, seed 1).
Reads test-results/atmo2/{before,after}/<backend>/L<n>-<tier>-z<zoom>.jpg (tools/atmosphere/capture.ts with
ATMOSPHERE_OUT=test-results/atmo2) and writes docs/reports/atmosphere-2/sheets/<backend>/L<n>.jpg. No retouching."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

src, out = Path('test-results/atmo2'), Path('docs/reports/atmosphere-2/sheets')
backends = sys.argv[1:] or ['webgl2']
rows = (('high', '1'), ('low', '0.5'))
W, H, T = 640, 360, 18
for backend in backends:
    (out / backend).mkdir(parents=True, exist_ok=True)
    for n in range(1, 11):
        sheet = Image.new('RGB', (2 * W, len(rows) * (H + T)), '#14171d')
        d = ImageDraw.Draw(sheet)
        for r, (tier, zoom) in enumerate(rows):
            for c, phase in enumerate(('before', 'after')):
                x, y = c * W, r * (H + T)
                d.text((x + 6, y + 3), f'L{n}  {phase}  {backend}  {tier}  zoom {zoom}', fill='white')
                f = src / phase / backend / f'L{n}-{tier}-z{zoom}.jpg'
                if f.exists():
                    im = Image.open(f); im.thumbnail((W, H)); sheet.paste(im, (x, y + T))
                else:
                    d.text((x + 20, y + 120), 'NOT CAPTURED', fill='red')
        sheet.save(out / backend / f'L{n}.jpg', quality=84)
