"""Render the retained unprofiled distributions; never infer a pass from diagnostics."""
import json
from pathlib import Path

root = Path(__file__).resolve().parent
rows = []
for level in ['L1', 'L4', 'L7', 'L8', 'L10']:
    for backend in ['webgpu', 'webgl2']:
        for quality in ['low', 'high']:
            key = f'{level}-{backend}-{quality}'
            values = []
            summaries = []
            for phase in ['before', 'after']:
                path = root / phase / f'{key}-summary.json'
                data = json.loads(path.read_text()) if path.exists() else None
                summaries.append(data)
                values.append('/'.join(f'{data[k] / 1000:.3f}' for k in ['median', 'p90', 'max']) if data else 'pending')
            before, after = summaries
            gate = after.get('gate', 'FAIL') if after else 'pending'
            count = f"{before['n'] if before else '—'}/{after['n'] if after else '—'}"
            frame = f"{after['maxFrameMs']:.1f}" if after else '—'
            rows.append(f'| {level} {backend} {quality} | {count} | {values[0]} | {values[1]} | {frame} | {gate} |')
header = '''# Cold-load distributions

Production snapshots, native Metal GPU, one headless browser through `quiet-run.sh`; a new browser/profile per observation. Times are click → closed loading card. Median is the mean of the middle pair; p90 uses nearest rank. Profiled traces are excluded.

The candidate records the first post-card frames of all 20 loads and a ten-second movement segment in the final fresh profile of each configuration. L10 lamp-boundary replay is a separate guard. `PASS` requires the executable probe gate to succeed, including ≤6 s worst load, median no slower, native backend, no browser errors and ≤200 ms post-card frames.

| Configuration | N before/after | Before median/p90/max (s) | After median/p90/max (s) | Max post-card (ms) | Gate |
| --- | ---: | --- | --- | ---: | --- |
'''
(root.parent / 'distributions.md').write_text(header + '\n'.join(rows) + '\n')
