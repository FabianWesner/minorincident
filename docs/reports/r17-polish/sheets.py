"""One compact, labelled full-frame sheet per fix; no screenshot cropping or retouching."""
import hashlib
import json
import math
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path('docs/reports/r17-polish')
plans = {
    'L9-apc': ('APC-{tier}-{backend}', ['APC-physical-entry', 'APC-front-110']),
    'L9-bridge': ('L9-crash-{tier}-{backend}', ['fall-3', 'impact-4', 'crawl-7']),
    'L4-canvas': ('L4-truck-{tier}-{backend}', ['rear-arrival-t1949', 'front-arrival-t1949']),
    'L5-shutter': ('L5-{tier}-{backend}-complete', ['metro-sequence-2', 'shutter-begin']),
    'L7-wreck': ('L7-{tier}-{backend}-complete', ['phase-playing']),
    'L7-departure': ('L7-{tier}-{backend}-complete', ['boarding-departing-1', 'boarding-departing-5']),
}
if len(sys.argv) > 1:
    plans = {name: plans[name] for name in sys.argv[1:]}
font = ImageFont.truetype('/System/Library/Fonts/Menlo.ttc', 10)
for name, (receipt_pattern, labels) in plans.items():
    cells = []
    for tier in ['low', 'high']:
        for backend in ['webgl2', 'webgpu']:
            receipt_path = root / (receipt_pattern.format(tier=tier, backend=backend) + '.json')
            receipt = json.loads(receipt_path.read_text())
            assert not receipt['errors'], receipt_path
            assert not receipt.get('failure'), receipt_path
            if name.startswith(('L5', 'L7')): assert receipt['finished'], receipt_path
            for label in labels:
                for zoom in [1, 1.5]:
                    found = [c for c in receipt['captures'] if c['label'] == label and c['requestedZoom'] == zoom]
                    assert len(found) == 1, (receipt_path, label, zoom)
                    c = found[0]
                    state = c['state']
                    assert state['quality'] == tier and state['backend'] == ('webgl' if backend == 'webgl2' else 'webgpu')
                    camera = c.get('camera', state.get('camera'))
                    if name in ['L5-shutter', 'L7-wreck', 'L7-departure', 'L9-bridge'] or label == 'APC-physical-entry':
                        assert abs(camera['zoom'] - zoom) < 1e-6, (receipt_path, label, zoom, camera)
                    if name == 'L4-canvas':
                        pose = camera['inspection']
                        assert abs(math.dist(pose['position'], pose['target']) - 19*zoom) < 1e-6
                    assert hashlib.sha256(Path(c['file']).read_bytes()).hexdigest() == c['sha256']
                    cells.append({**c, 'tier': tier, 'backend': backend, 'receipt': receipt_path.name,
                                  'actualCamera': camera})
    cols = 6 if name == 'L9-bridge' else 4
    w, h = 320, 216
    sheet = Image.new('RGB', (cols*w, math.ceil(len(cells)/cols)*h), '#111720')
    draw = ImageDraw.Draw(sheet)
    for i, c in enumerate(cells):
        x, y = i % cols*w, i // cols*h
        shot = Image.open(c['file']).convert('RGB'); shot.thumbnail((w,180))
        sheet.paste(shot, (x, y+36))
        p = c['state'].get('position') or {}
        lines = [f"{i+1:02} {c['tier']}/{c['backend']} z{c['requestedZoom']}",
                 c['label'], f"t{c['state']['tick']} ({p.get('x',0):.1f},{p.get('z',0):.1f})"]
        for j, line in enumerate(lines): draw.text((x+3,y+j*12),line,font=font,fill='#ffe5a4' if j==0 else '#dce5ef')
        c['cell'] = i+1
        c['rawOriginal'] = c.pop('file')
    output = root / (name + '.jpg')
    for quality in range(86,30,-4):
        sheet.save(output, quality=quality, optimize=True)
        if output.stat().st_size <= 380*1024: break
    assert output.stat().st_size <= 380*1024
    manifest = {'fix': name, 'sheet': output.name, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(),
                'method': 'Uniformly resized full screenshots with labels. Requested zoom and actual authored camera are separate. No cropping or retouching.',
                'reviewed': False, 'cells': cells}
    (root / (name + '.json')).write_text(json.dumps(manifest,indent=2)+'\n')
    print(name, len(cells), output.stat().st_size)
