"""Package captured PNGs as review sheets without resizing; run after capture/LOD tools."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).parent
for backend, before, after in [('webgl2', 'before/lods', 'final/lods'), ('webgpu', 'before/lods-webgpu', 'final/lods-webgpu')]:
    a = Image.open(root / before / 'sheet-01.png').convert('RGB')
    b = Image.open(root / after / 'sheet-01.png').convert('RGB')
    sheet = Image.new('RGB', (a.width + b.width, max(a.height, b.height) + 30), '#17151b')
    sheet.paste(a, (0, 30))
    sheet.paste(b, (a.width, 30))
    labels = ImageDraw.Draw(sheet)
    labels.text((10, 8), 'BEFORE / ' + backend, fill='white')
    labels.text((a.width + 10, 8), 'AFTER / ' + backend, fill='white')
    sheet.save(root / 'comparisons' / f'lods-{backend}.png')
for capture in (root / 'comparisons').glob('*-z*.png'):
    Image.open(capture).convert('RGB').save(capture.with_suffix('.jpg'), quality=95, subsampling=0)
    capture.unlink()
