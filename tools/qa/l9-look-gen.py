#!/usr/bin/env python3
"""look-l9: Scene Lab specs of the L9 night drive as the player sees it: the healthy APC driving each stretch, game camera on it.
usage: l9-look-gen.py <out_dir> [zooms=0.5,1,1.5] [health=1000]
Writes one spec per (stretch, zoom) with a single hi-res shot at the end of a 40 m drive (frame 150) and a contact sheet."""
import json, math, os, sys
out = sys.argv[1]
zooms = [float(z) for z in (sys.argv[2] if len(sys.argv) > 2 else '0.5,1,1.5').split(',')]
health = int(sys.argv[3]) if len(sys.argv) > 3 else 1000
# (name, start, towards): the APC drives from start along the direction for ~40 m.
stretches = [
    ('fork', (-505, 0), (-455, 0)),
    ('road-diagonal', (-410, -132), (-350, -330)),
    ('road-diner', (70, -330), (140, -330)),
    ('countryside-farm', (-60, 240), (40, 240)),
    ('dry-mast', (-110, -30), (-40, -30)),
    ('dry-flares', (110, -30), (180, -30)),
    ('road-hazard', (-188, -330), (-130, -330)),
    ('crash-approach', (420, 0), (462, 0)),
    # look-l9b: the burning city edge is a fixed game-camera view (no APC drives there: the road ends at the crash).
    ('city-edge', (560, 40), None),
]
os.makedirs(out, exist_ok=True)
for name, (x, z), target in stretches:
    if target:
        tx, tz = target
        d = math.hypot(tx - x, tz - z); ux, uz = (tx - x) / d, (tz - z) / d
        end = [round(x + ux * 40, 2), round(z + uz * 40, 2)]
    else:
        end = [x, z]
    for zoom in zooms:
        spec = {
            'name': f'l9look-{name}-z{zoom}', 'seed': 31, 'ground': 'district', 'time': 'L9-crossing', 'dof': False,
            'layout': {'district': 'D-CROSSING', 'bbox': [[min(x, end[0]) - 90, min(z, end[1]) - 90], [max(x, end[0]) + 90, max(z, end[1]) + 90]]},
            'camera': {'mode': 'game', 'target': 'apc' if target else [x, z], 'zoom': zoom},
            'frames': 150, 'shots': [149], 'sheet': 50,
            'expect': {'consoleErrors': 0, 'clippingMax': 0, 'drawCallsMax': 300, 'trianglesMax': 500000},
        }
        if target:
            spec['vehicles'] = [{'id': 'apc', 'asset': 'vehicle.military-apc', 'at': [x, z], 'yaw': round(math.degrees(math.atan2(-uz, ux)), 2), 'path': [end], 'health': health, 'floor': True, 'driven': True}]
        json.dump(spec, open(os.path.join(out, f'{name}-z{zoom}.json'), 'w'), indent=1)
print(len(stretches) * len(zooms), 'specs in', out)
