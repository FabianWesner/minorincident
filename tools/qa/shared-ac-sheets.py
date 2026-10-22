"""Compose retained E07/E27 evidence; labels/resizing only, no image corrections."""
import gzip
import hashlib
import json
from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFont

DEST = Path('docs/reports/ac-close-shared')
DEST.mkdir(parents=True, exist_ok=True)
FONT_PATH = '/System/Library/Fonts/Menlo.ttc'
FONT = ImageFont.truetype(FONT_PATH, 12) if Path(FONT_PATH).exists() else ImageFont.load_default()


def sheet(name, rows, width=320, height=180):
    columns = max(len(row) for row in rows)
    result = Image.new('RGB', (columns * width, len(rows) * (height + 30)), '#111722')
    draw = ImageDraw.Draw(result)
    for row, cells in enumerate(rows):
        for col, (path, label) in enumerate(cells):
            frame = Image.open(path).convert('RGB')
            frame.thumbnail((width, height), Image.Resampling.LANCZOS)
            x, y = col * width, row * (height + 30)
            result.paste(frame, (x + (width - frame.width) // 2, y))
            draw.text((x + 4, y + height + 3), label, font=FONT, fill='white')
    result.save(DEST / name, quality=92, subsampling=0)


if sys.argv[1] == 'repairs':
    root = Path('test-results')
    sheet('smoke-repair.jpg', [[
        (root / 'ac-close-shared/smoke-probe/direct.png', 'Before: night smoke player 1.013:1'),
        (root / 'epics/E27/ac12-smoke-player.png', 'After: night smoke player 2.173:1'),
    ], [
        (root / 'epics/E27/ac11-strobe-off.png', 'Actual cloud / beacon off phase'),
        (root / 'epics/E27/ac11-strobe-on.png', 'Actual cloud / beacon on phase'),
    ]], 800, 450)
    sheet('warning-repair.jpg', [[
        (root / 'ac-close-shared/warning-comparison/before.png', 'Before: second windup warning had opacity zero'),
        (root / 'epics/E07/move-boundaries/alpha.charge/08-second-windup.png', 'After: second windup visible while paused'),
    ]], 640, 360)
elif sys.argv[1] == 'moves':
    root = Path('test-results/epics/E07/move-boundaries')
    moves = ['alpha.charge', 'alpha.ground-slam', 'alpha.grab-throw', 'alpha.roar', 'lion.pounce', 'lion.flank', 'gorilla.roar',
             'gorilla.pound', 'gorilla.grab-throw', 'elephant.charge', 'elephant.swipe', 'zebra.kick', 'zebra.stampede', 'flamingo.dive']
    evidence = []
    for move in moves:
        record = json.loads((root / move / 'proof.json').read_text())
        record['captures'] = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((root / move).glob('*.png'))}
        evidence.append(record)
    for group, start in [('a', 0), ('b', 7)]:
        names = sorted(p.name for p in (root / moves[start]).glob('*.png'))
        for part, phases in enumerate([names], 1):
            rows = []
            for move in moves[start:start + 7]:
                ticks = {p['name']: p['tick'] for p in evidence[moves.index(move)]['proof']}
                rows.append([(root / move / phase, f"{move} | t{ticks.get(Path(phase).stem, 'pre')} | {Path(phase).stem}") for phase in phases])
            sheet(f'moves-{group}-{part}.jpg', rows)
    with gzip.open(DEST / 'evidence/move-boundaries.json.gz', 'wt') as f:
        json.dump(evidence, f, separators=(',', ':'))
elif sys.argv[1] != 'bars':
    raise SystemExit('Use repairs, moves or bars')

if sys.argv[1] == 'bars':
    root = Path('test-results/ac-close-shared')
    rows = []
    for backend in ['webgl2', 'webgpu']:
        for night in [0, 1]:
            folder = root / 'bars' / f'{backend}-{night}'
            for width in [1600, 390, 844]:
                label = f'{backend} {width} ' + ('night' if night else 'day')
                rows.append([(folder / f'after-{width}.png', label + ' real HP'),
                             (folder / f'occlusion-before-{width}.png', 'day: hidden behind building'),
                             (folder / f'occlusion-after-{width}.png', 'day: camera reveals bar'),
                             (folder / f'zoo-after-{width}.png', 'day: lion/gorilla/flamingo')])
    actual = root / 'bars-final'
    rows.append([(actual / 'alpha-before-1600.png', 'Actual Alpha 1600: full HP'),
                 (actual / 'alpha-after-1600.png', 'Actual Alpha 1600: real damage')])
    phone = Path('test-results/epics/E07/phone-bars')
    for width in [390, 844]:
        rows.append([(actual / f'alpha-before-{width}.png', f'Actual Alpha {width}: full HP'),
                     (actual / f'alpha-after-{width}.png', f'Actual Alpha {width}: damaged'),
                     (phone / f'elephant-{width}.png', f'Elephant {width}: 900/1200 HP'),
                     (phone / f'zebra-flamingo-{width}.png', f'Zebra/flamingo {width}: real HP')])
    # Preserve portrait detail rather than reducing a phone into a landscape tile.
    heights = [225] * 13 + [844, 225]
    result = Image.new('RGB', (1600, sum(h + 30 for h in heights)), '#111722')
    draw = ImageDraw.Draw(result)
    top = 0
    manifest = []
    for cells, height in zip(rows, heights):
        for col, (path, label) in enumerate(cells):
            frame = Image.open(path).convert('RGB')
            frame.thumbnail((400, height), Image.Resampling.LANCZOS)
            result.paste(frame, (col * 400 + (400 - frame.width) // 2, top))
            draw.text((col * 400 + 4, top + height + 3), label, font=FONT, fill='white')
            manifest.append({'path': str(path), 'label': label, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
        top += height + 30
    result.save(DEST / 'bars.jpg', quality=92, subsampling=0)
    proofs = {str(p): json.loads(p.read_text()) for p in [*actual.glob('alpha-proof-*.json'), *phone.glob('*.json')]}
    with gzip.open(DEST / 'evidence/phone-bars-final.json.gz', 'wt') as f:
        json.dump({'proofs': proofs, 'images': manifest}, f)
