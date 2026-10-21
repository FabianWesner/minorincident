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
else:
    raise SystemExit('Use repairs or moves')
