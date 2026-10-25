"""skinned-crowd prototype scenes (specs/scenes/skinned-crowd/*.json).

python3 tools/scenelab/skinned-crowd-specs.py
Run each with --query skinCrowd=1 (skinned), skinCrowd=rigid (same welded bodies, dominant joint only)
or without the flag (main's rigid crowd) to compare.
"""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'specs/scenes/skinned-crowd'
OUT.mkdir(parents=True, exist_ok=True)
MODELS = ['inf.common-worker', 'npc.civilian-woman-a']
NOTE = 'skinned-crowd prototype. --query skinCrowd=1 skinned bodies, skinCrowd=rigid same bodies on the dominant joint, no flag = main rigid crowd.'


def courier(at):
    # (the far pedestrian registers npc.civilian-woman-a as a crowd model, so infected can wear it through CrowdView)
    return [{'id': 'courier', 'kind': 'courier', 'at': at, 'loadout': ['weapon.bat', 'weapon.fists']}, {'id': 'ped', 'kind': 'pedestrian', 'at': [11, 11], 'look': {'model': 'npc.civilian-woman-a'}}]


def _unused(at):
    return {'id': 'courier', 'kind': 'courier', 'at': at, 'loadout': ['weapon.bat', 'weapon.fists']}


def write(name, spec):
    (OUT / f'{name}.json').write_text(json.dumps({'name': name, 'note': NOTE, **spec}, indent=1) + '\n')


# Close pairs: chase (walk/run/swing at the courier) and idle, game camera zoom 1 and 1.5.
for zoom in (1, 1.5):
    actors = courier([0, 4])
    for k, model in enumerate(MODELS * 2):
        actors.append({'id': f'z{k}', 'kind': 'infected', 'at': [-1.5 + k, -1.5], 'yaw': 0, 'state': 'chase' if k < 2 else 'idle', 'archetype': 'infected.sprinter', 'look': {'model': model}})
    write(f'close-z{zoom}'.replace('.', '_'), {'ground': 'asphalt', 'size': 24, 'time': 'golden', 'actors': actors,
          'camera': {'mode': 'game', 'target': [0, 0.5], 'zoom': zoom * 0.5}, 'frames': 240, 'shots': [30, 90, 150, 210], 'sheet': 12})

# 30-figure crowd sheet: 5 x 6 grid, alternating models, standing (idle) and walking toward the courier.
actors = courier([0, 9])
for row in range(5):
    for col in range(6):
        k = row * 6 + col
        actors.append({'id': f'c{k}', 'kind': 'infected', 'at': [-3.75 + col * 1.5, -4 + row * 1.6], 'yaw': [0, 45, 90, 135, 180, -90][k % 6], 'state': 'idle',
                       'archetype': 'infected.sprinter', 'look': {'model': MODELS[(row + col) % 2]}})
write('crowd30', {'ground': 'asphalt', 'size': 30, 'time': 'golden', 'actors': actors, 'camera': {'mode': 'game', 'target': [0, -0.8], 'zoom': 0.75}, 'frames': 90, 'shots': [90], 'sheet': 4})
