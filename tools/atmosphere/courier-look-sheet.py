"""Courier night look sheets: one page per backend and spot; rows = survivor x tier, columns = zoom.
Each cell is the courier crop, daylight reference (left) | night (right), from tools/atmosphere/courier-look.ts.
Usage: python3 tools/atmosphere/courier-look-sheet.py <capture dir>/<phase> <out dir>. No retouching."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
H, T = 230, 16
for backend_dir in sorted(p for p in src.iterdir() if p.is_dir()):
    rows = json.loads((backend_dir / 'index.json').read_text())
    for spot in dict.fromkeys(r['spot'] for r in rows):
        sel = [r for r in rows if r['spot'] == spot]
        lines = list(dict.fromkeys((r['variant'], r['tier']) for r in sel))
        zooms = sorted(dict.fromkeys(r['zoom'] for r in sel))
        W = 2 * H
        sheet = Image.new('RGB', (len(zooms) * W, len(lines) * (H + T)), '#14171d')
        d = ImageDraw.Draw(sheet)
        for r in sel:
            x, y = zooms.index(r['zoom']) * W, lines.index((r['variant'], r['tier'])) * (H + T)
            fails = '; '.join(r['failures']) or 'colours ok'
            d.text((x + 4, y + 2), f"{r['variant']} {r['tier']} z{r['zoom']}  day | night  C {r['contrast']:.2f}  clip {r['clippedShare']*100:.1f}%  {fails}"[:78], fill='white')
            im = Image.open(backend_dir / f"{r['name']}-crop.png").convert('RGB').resize((W, H))
            sheet.paste(im, (x, y + T))
        sheet.save(out / f'{spot}-{backend_dir.name}.jpg', quality=86)
