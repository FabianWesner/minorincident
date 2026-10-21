#!/usr/bin/env python3
"""world-fill (PO #34): game-camera Scene Lab specs of the L8 drive-out, the L9 drive and the six L10 regions.
usage: world-fill-gen.py <out_dir> [zooms=1]   (zoom 1 only -> the catalog specs tests/scenes/catalog/world-fill-*.json)
L10 stations: the courier runs along a mid-region stretch (away from anchors, where most of the run happens).
L8/L9 stations: the healthy APC drives 40 m of the lane, as the player does after boarding at the zoo."""
import json, math, os, sys
out = sys.argv[1]
zooms = [float(z) for z in (sys.argv[2] if len(sys.argv) > 2 else '1').split(',')]
L10 = [  # (name, start, towards, note)
    ('l10-r1-crash', (668, 25), (708, 25), 'R1 crash outskirts: broken picket fences, field trees, sheds, wrecked cars and poles right past the dark shoulder.'),
    ('l10-r2-fringe', (1095, 25), (1135, 25), 'R2 residential fringe: hedges / garden walls / privacy fences past the sidewalk, bins, parked cars, front-yard trees, house roofs.'),
    ('l10-r3-industrial', (1380, 100), (1420, 100), 'R3 industrial: mil-fence runs, drums, pallets, crates, dumpsters, container stacks and trucks beside the yard road.'),
    ('l10-r4-military', (1960, -75), (2000, -75), 'R4 military: jersey-barrier runs, sandbag pallets, wrecked armour and trucks, guard towers.'),
    ('l10-r5-campus', (2600, 45), (2640, 45), 'R5 research campus: hedges, street trees, tents, generators, ambulances, lab annexes.'),
    ('l10-r6-corridor', (3080, 95), (3120, 95), 'R6 destroyed corridor: burned cars, barricades, burned facades and w3 ruins in the dark light group.'),
]
L9 = [
    ('l8-driveout', (-548, 0), (-508, 0), 'L8 drive-out = the L9 start: the APC sets off east from the zoo road; verge belts, hedges, fences, bushes either side.'),
    ('l9-road', (150, -330), (190, -330), 'L9 asphalt loop mid-drive: avenue trees, hedges, fences, poles, wrecks close to the 12 m lane.'),
    ('l9-countryside', (100, 240), (140, 240), 'L9 countryside gravel lane: hedgerows, field fences, farm stock, trees.'),
    ('l9-dry', (-205, -30), (-165, -30), 'L9 dry shortcut: scrub, wrecks, barriers, poles beside the gravel.'),
]
COMMON = 'Look for roadside mass in every frame within ~4-12 m of the road edge (no flat dark plane), nothing on the lane, no floating or sunk props, no clipping, no flicker.'
os.makedirs(out, exist_ok=True)
for district, time, seed, stations, actor in (('D-CURE', 'L10-night', 32, L10, 'courier'), ('D-CROSSING', 'L9-crossing', 31, L9, 'apc')):
    for name, (x, z), (tx, tz), note in stations:
        d = math.hypot(tx - x, tz - z); ux, uz = (tx - x) / d, (tz - z) / d
        for zoom in zooms:
            spec = {
                'name': f'world-fill-{name}' + ('' if zooms == [1.0] else f'-z{zoom}'), 'note': f'world-fill (PO #34): {note} {COMMON}',
                'seed': seed, 'ground': 'district', 'time': time, 'dof': False,
                'layout': {'district': district, 'bbox': [[min(x, tx) - 80, min(z, tz) - 70], [max(x, tx) + 80, max(z, tz) + 70]]},
                'camera': {'mode': 'game', 'target': actor, 'zoom': zoom},
                'frames': 200 if actor == 'courier' else 150, 'shots': [199 if actor == 'courier' else 149], 'sheet': 50,
                'clipping': {'ignoreFoliage': True},
                'expect': {'consoleErrors': 0, 'clippingMax': 0, 'drawCallsMax': 300, 'trianglesMax': 500000},
            }
            if actor == 'courier':
                spec['actors'] = [{'id': 'courier', 'kind': 'courier', 'at': [x, z]}]
                spec['script'] = [{'frame': 0, 'actor': 'courier', 'do': {'run': [[tx, tz]]}}]
            else:
                spec['vehicles'] = [{'id': 'apc', 'asset': 'vehicle.military-apc', 'at': [x, z], 'yaw': round(math.degrees(math.atan2(-uz, ux)), 2), 'path': [[tx, tz]], 'health': 1000, 'floor': True, 'driven': True}]
            json.dump(spec, open(os.path.join(out, spec['name'] + '.json'), 'w'), indent=1)
            open(os.path.join(out, spec['name'] + '.json'), 'a').write('\n')
print((len(L10) + len(L9)) * len(zooms), 'specs in', out)
