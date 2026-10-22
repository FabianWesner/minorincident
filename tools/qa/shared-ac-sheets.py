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
    return result


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
elif sys.argv[1] == 'horde':
    root = Path('test-results/ac-close-shared/horde')
    rows = []
    manifest = []
    for backend in ['webgl2', 'webgpu']:
        for tier in ['high', 'low']:
            row = []
            for zoom in ['0.5', '1', '1.5']:
                for suffix in ['', '-telegraphs']:
                    path = root / f'{backend}-{tier}-z{zoom}{suffix}.png'
                    label = f'{backend} {tier} z{zoom}' + (' + warnings' if suffix else ' 60 runners')
                    row.append((path, label))
                    manifest.append({'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'label': label})
            rows.append(row)
    matrix = sheet('d-horde.jpg', rows, 400, 225)
    result = Image.new('RGB', (2400, matrix.height + 705), '#111722')
    result.paste(matrix, (0, 0))
    draw = ImageDraw.Draw(result)
    dog_images = []
    for col, label in enumerate(['before', 'after']):
        path = Path(f'test-results/ac-close-shared/dog-coats/{label}.png')
        frame = Image.open(path).convert('RGB').resize((1200, 675), Image.Resampling.LANCZOS)
        result.paste(frame, (col * 1200, matrix.height))
        caption = ('Palette before b4c06bb7: 3 authored dog batches' if label == 'before' else 'Palette after 9e5c4b0b: 2 batches, 0 changed RGB pixels') + ' (visual isolation only)'
        draw.text((col * 1200 + 4, matrix.height + 678), caption, font=FONT, fill='white')
        dog_images.append({'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'label': caption})
    result.save(DEST / 'd-horde.jpg', quality=92, subsampling=0)
    (DEST / 'evidence/D-final-images.json').write_text(json.dumps({'runtimeSource': 'df390443a', 'frames': manifest, 'dogPaletteProofAt': '9e5c4b0b1', 'dogFrames': dog_images}, indent=2) + '\n')
elif sys.argv[1] == 'vfx':
    root = Path('test-results/ac-close-shared/vfx')
    phases = {
        'medium': [0, 6, 8, 12, 21, 46, 186, 906],
        'car': [0, 184, 186, 190, 200, 230, 360, 1080],
        'mega': [0, 6, 20, 40, 46, 70, 220, 940],
        'building-night': [60, 90, 180, 600],
        'grenade': [1, 90, 240, 840],
        'column': [60, 180, 360, 600],
        'collapse': [0, 2, 6, 15, 40, 120, 300, 900],
    }
    manifest = []
    for tier in ['high', 'low']:
        rows = []
        for name, frames in phases.items():
            row = []
            for frame in frames:
                path = root / f'{tier}-{name}-f{frame}.png'
                label = f'{tier} {name} f{frame}'
                row.append((path, label))
                manifest.append({'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'label': label})
            rows.append(row)
        sheet(f'h-{tier}.jpg', rows, 420, 236)
    (DEST / 'evidence/H-final-images.json').write_text(json.dumps({'runtimeSource': 'df390443a', 'frames': manifest}, indent=2) + '\n')
elif sys.argv[1] != 'bars':
    raise SystemExit('Use repairs, moves, bars, horde or vfx')

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
