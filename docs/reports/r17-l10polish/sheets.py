"""Retain one compact reviewed contact sheet per requested fix, with screenshot provenance."""
import gzip
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).parent
FONT = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 13)
TITLE = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 15)
records = [json.loads(gzip.open(p).read()) for p in ROOT.glob('*.json.gz') if p.name.startswith(('environment-', 'ending-', 'barn-'))]
final = [r for r in records if not r['tag'].endswith('-fast')]

def cells(mode, labels, zoom=1.5, portrait=False, carried=None):
    return [(r, c) for r in final if r['mode'] == mode and (r['aspect'] == 'portrait') == portrait
            and (carried is None or r['tag'].endswith('-carried') == carried)
            for c in r['captures'] if c['label'] in labels and (zoom is None or c['zoom'] == zoom)]

plans = {
    'hangar': cells('environment', ['hangar-interior'], None) + cells('environment', ['hangar-exterior']),
    'barn': cells('environment', ['barn-intact', 'barn-collapsed']) + cells('barn', ['barn-graves']),
    'farm': cells('environment', ['farm-PO', 'farm-route-1650', 'farm-route-3150', 'farm-route-3450']),
    'propane': cells('environment', ['propane-tank'], None),
    'panorama': cells('ending', ['ending-55s', 'ending-60s'], carried=False),
    'ending-budget': cells('ending', ['credits'], 1, carried=False) + cells('ending', ['credits'], 1, True, False)
                     + [(r, c) for r, c in cells('ending', ['ending-25s'], 1, carried=False) if r['backend'] == 'webgl2'],
    'closing-cast': cells('ending', ['ending-30s', 'ending-45s'], 1, carried=True) + cells('ending', ['ending-30s', 'ending-45s'], 1.5, True, True)
                    + [(r, c) for r, c in cells('ending', ['ending-50s'], 1.5, carried=False) if r['backend'] == 'webgl2'],
}
manifest = {'method': 'Selected actual production captures; fit each full frame inside a 384×216 cell. Labels retain requested quality/backend/zoom and measured draws/triangles. Raw hashes and exact camera/state remain in the compressed run receipts.', 'sheets': []}
for name, selected in plans.items():
    if len(sys.argv) > 1 and name not in sys.argv[1:]: continue
    selected.sort(key=lambda p: (p[0]['tier'], p[0]['backend'], p[0]['aspect'], p[1]['label'], p[1]['zoom']))
    assert selected, name
    cols = 4
    width, height = 384, 258
    rows = (len(selected) + cols - 1) // cols
    canvas = Image.new('RGB', (cols * width, 30 + rows * height), '#191b22')
    draw = ImageDraw.Draw(canvas)
    draw.text((8, 7), f'R17 L10 — {name}', fill='white', font=TITLE)
    provenance = []
    for i, (record, capture) in enumerate(selected):
        x, y = i % cols * width, 30 + i // cols * height
        source = Path(capture['file'])
        assert hashlib.sha256(source.read_bytes()).hexdigest() == capture['sha256'], source
        picture = Image.open(source).convert('RGB')
        picture.thumbnail((width, 216), Image.Resampling.LANCZOS)
        canvas.paste(picture, (x + (width - picture.width) // 2, y))
        state = capture['state']
        draw.text((x + 5, y + 218), f"{record['tier']} {record['backend']} {record['aspect']} z{capture['zoom']} · {capture['label']}", fill='white', font=FONT)
        draw.text((x + 5, y + 236), f"{state['draws']} draws · {state['triangles']:,} triangles", fill='#c0c9d4', font=FONT)
        provenance.append({'tag': record['tag'], 'label': capture['label'], 'zoom': capture['zoom'], 'source': capture['file'], 'sha256': capture['sha256'], 'tick': state['tick'], 'position': state['position'], 'camera': state['camera'], 'draws': state['draws'], 'triangles': state['triangles'], 'actualBackend': state['actualBackend'], 'actualQuality': state['actualQuality']})
    path = ROOT / f'{name}.jpg'
    canvas.save(path, quality=85, optimize=True)
    manifest['sheets'].append({'file': path.name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'cells': provenance})
(ROOT / 'sheets.json').write_text(json.dumps(manifest, indent=2) + '\n')
print([(s['file'], len(s['cells'])) for s in manifest['sheets']])
