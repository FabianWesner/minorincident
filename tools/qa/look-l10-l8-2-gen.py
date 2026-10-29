#!/usr/bin/env python3
"""look-l10-l8-2: close-up catalog specs of the new L10 night-field story spots and the L8 sanctuary lawns/habitats.
usage: look-l10-l8-2-gen.py [out_dir=tests/scenes/catalog]   (game camera, zoom 1.5 = widest; the -z1 twin uses the default zoom)"""
import json, os, sys
out = sys.argv[1] if len(sys.argv) > 1 else 'tests/scenes/catalog'
L10 = [('look-l10-fields-r1-camp', (650, 25), (690, 25), 'R1 crash outskirts: the abandoned field camp (tent, campfire, chairs) and burning wrecks that left the road, furrowed field strips from 6.6 m.'),
       ('look-l10-fields-r4-evac', (2030, -75), (2070, -75), 'R4 military zone: a flood-lit evac point in the field (light tower, iso tents, generator, ambulance, sandbags), crop rows and a burning car.')]
L8 = [('look-l8-habitats-lion', (-62, -7), (-42, -7), 'L8 central path along the lion paddock: sand floor, river-kit rocks, shade tree; grass verges, park trees, shrubs and flower drifts on the public lawn.'),
      ('look-l8-habitats-elephant', (-96, 50), (-96, 24), 'L8 west loop past the elephant paddock: mud floor, water hole, hay feeder; grass verges and tree groves between the wall and the paddock.')]
GOAL = {'L10': 'QA batch 20: "The night fields are mostly empty dark green apart from the courier\'s lamp"', 'L8': 'QA batch 26: "L8 is mostly APC and dark lawn"'}
os.makedirs(out, exist_ok=True)
for level, district, time, seed, rows in (('L10', 'D-CURE', 'L10-night', 32, L10), ('L8', 'D-ZOO', 'L8-zoo', 8, L8)):
    for name, (x, z), (tx, tz), note in rows:
        for zoom in (1.0, 1.5):
            spec = {'name': name + ('' if zoom == 1.5 else '-z1'),
                    'note': f'look-l10-l8-2 ({GOAL[level]}): {note} Look for: ground that reads as a place, warm pools off the route verge, nothing floating or sunk, no clipping, no flicker.',
                    'seed': seed, 'ground': 'district', 'time': time, 'dof': False,
                    'layout': {'district': district, 'bbox': [[min(x, tx) - 80, min(z, tz) - 70], [max(x, tx) + 80, max(z, tz) + 70]]},
                    'camera': {'mode': 'game', 'target': 'courier', 'zoom': zoom}, 'frames': 200, 'shots': [199], 'sheet': 50,
                    'clipping': {'ignoreFoliage': True},
                    'actors': [{'id': 'courier', 'kind': 'courier', 'at': [x, z]}],
                    'script': [{'frame': 0, 'actor': 'courier', 'do': {'run': [[tx, tz]]}}],
                    'expect': {'consoleErrors': 0, 'drawCallsMax': 300, 'trianglesMax': 500000}}
            path = os.path.join(out, spec['name'] + '.json')
            with open(path, 'w') as f: json.dump(spec, f, indent=1); f.write('\n')
print('specs in', out)
