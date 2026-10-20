#!/usr/bin/env python3
"""look-l9b (L10): Scene Lab specs of the L10 night run as the player sees it, one hi-res shot per region at the end of a 60 m run.
usage: l10-look-gen.py <out_dir> [zooms=1,1.5]
Rows: crash (R1), fringe (R2), military (R4), campus (R5), corridor (R6), complex (R7 approach), epilogue (fixed camera at the
cure console). Sheet: tools/qa/l9-look-sheet.py with the l10look- prefix via PREFIX=l10look-."""
import json, math, os, sys
out = sys.argv[1]
zooms = [float(z) for z in (sys.argv[2] if len(sys.argv) > 2 else '1,1.5').split(',')]
spots = [
    ('crash', (570, 0), (630, 0)),
    ('fringe', (1090, 25), (1150, 25)),
    ('military', (2250, -75), (2310, -75)),
    ('campus', (2600, 45), (2660, 45)),
    ('corridor', (3100, 95), (3160, 95)),
    ('complex', (3800, -41), (3860, -41)),
    ('epilogue', (3998, -27), None),
]
os.makedirs(out, exist_ok=True)
for name, (x, z), target in spots:
    end = [target[0], target[1]] if target else [x, z]
    for zoom in zooms:
        spec = {
            'name': f'l10look-{name}-z{zoom}', 'seed': 32, 'ground': 'district', 'time': 'L10-night', 'dof': False,
            'layout': {'district': 'D-CURE', 'bbox': [[min(x, end[0]) - 90, min(z, end[1]) - 70], [max(x, end[0]) + 90, max(z, end[1]) + 70]]},
            'camera': {'mode': 'game', 'target': 'courier' if target else [x, z], 'zoom': zoom},
            'frames': 200, 'shots': [199], 'sheet': 50, 'clipping': {'ignoreFoliage': True},
            'expect': {'consoleErrors': 0, 'clippingMax': 0, 'drawCallsMax': 300, 'trianglesMax': 500000},
        }
        if target:
            spec['actors'] = [{'id': 'courier', 'kind': 'courier', 'at': [x, z]}]
            spec['script'] = [{'frame': 0, 'actor': 'courier', 'do': {'run': [end]}}]
        json.dump(spec, open(os.path.join(out, f'{name}-z{zoom}.json'), 'w'), indent=1)
print(len(spots) * len(zooms), 'specs in', out)
