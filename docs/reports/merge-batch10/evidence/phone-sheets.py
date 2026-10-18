from pathlib import Path
from PIL import Image, ImageDraw
root = Path('docs/reports/merge-batch10')
scenes = [p.stem for p in sorted(Path('tests/scenes/catalog').glob('ui-night-*.json'))]
for backend in ['webgl2', 'webgpu']:
 for dims in ['390x844', '844x390']:
  tile_h = 693 if dims == '390x844' else 148
  sheet = Image.new('RGB', (960, (tile_h + 24) * len(scenes)), '#171b24')
  draw = ImageDraw.Draw(sheet)
  for row, name in enumerate(scenes):
   for col, zoom in enumerate([.5, 1, 1.5]):
    f = root / 'matrix' / ('phone-' + backend) / f'{name}@low-z{zoom:g}-{dims}' / 'sheet.jpg'
    im = Image.open(f).crop((0, 0, 320, tile_h))
    x, y = col * 320, row * (tile_h + 24)
    draw.text((x+3,y+5), f'{name} low z{zoom:g} {backend}',fill='white')
    sheet.paste(im,(x,y+24))
  sheet.save(root / 'sheets' / f'phone-{backend}-{dims}.jpg',quality=88)
