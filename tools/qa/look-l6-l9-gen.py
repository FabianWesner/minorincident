#!/usr/bin/env python3
"""look-l6-l9: game-camera specs of the L6 route (shelter -> tunnel -> Northgate exit) as the courier walks it with the headlamp.
usage: look-l6-l9-gen.py <out_dir> [zooms=1,1.5]
One spec per (region, zoom): the courier runs ~14 m along the route, one shot at the end (L9 uses tools/qa/l9-look-gen.py)."""
import json, os, sys
out = sys.argv[1]
zooms = [float(z) for z in (sys.argv[2] if len(sys.argv) > 2 else '1,1.5').split(',')]
# (name, start, target, time preset): the walked route of a real-input L6 run (shelter floor, tunnel lane z=15, escalator, street).
regions = [
    ('shelter', (-10, -4), (2, -4), 'L6-subway'),
    ('tunnel-west', (36, 15), (50, 15), 'L6-subway'),
    ('tunnel-mid', (136, 15), (150, 15), 'L6-subway'),
    ('tunnel-east', (214, 15), (228, 15), 'L6-subway'),
    ('exit-platform', (232, 15), (244, 15), 'L6-subway'),
    ('street', (262, 15), (274, 15), 'L6'),
]
os.makedirs(out, exist_ok=True)
for name, (x, z), (tx, tz), time in regions:
    for zoom in zooms:
        spec = {
            'name': f'l6look-{name}-z{zoom}', 'seed': 1, 'ground': 'district', 'time': time, 'dof': False, 'l6Subway': 'lamp', 'hud': False,
            'layout': {'level': 'L6', 'district': 'D-SUBWAY', 'bbox': [[-32, -30], [288, 32]]},
            'actors': [{'id': 'courier', 'kind': 'courier', 'at': [x, z]}],
            'script': [{'frame': 0, 'actor': 'courier', 'do': {'run': [[tx, tz]]}}],
            'camera': {'mode': 'game', 'target': 'courier', 'zoom': zoom},
            'frames': 150, 'shots': [149], 'sheet': 50,
            'clipping': {'ignoreFoliage': True},
            'expect': {'consoleErrors': 0, 'drawCallsMax': 600, 'trianglesMax': 1500000, 'trianglesMaxLow': 500000},
        }
        json.dump(spec, open(os.path.join(out, f'{name}-z{zoom}.json'), 'w'), indent=1)
print(len(regions) * len(zooms), 'specs in', out)
