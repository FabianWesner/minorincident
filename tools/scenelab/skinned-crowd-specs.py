"""skinned-crowd prototype scenes (specs/scenes/skinned-crowd/*.json).

python3 tools/scenelab/skinned-crowd-specs.py
Run each with --query skinCrowd=1 (skinned), skinCrowd=rigid (same welded bodies, dominant joint only)
or without the flag (main's rigid crowd) to compare.
Player zoom Z (1 = default, 1.5 = close) is the Scene Lab game camera at radius 19 / Z.
"""
import json
from pathlib import Path

OUT = Path(__file__).resolve().parents[2] / 'specs/scenes/skinned-crowd'
OUT.mkdir(parents=True, exist_ok=True)
MODELS = ['inf.common-worker', 'npc.civilian-woman-a']
NOTE = 'skinned-crowd prototype. --query skinCrowd=1 skinned bodies, skinCrowd=rigid same bodies on the dominant joint, no flag = main rigid crowd.'


def cast(at):
    # The far pedestrian registers npc.civilian-woman-a as a crowd model, so infected can wear it through CrowdView.
    return [{'id': 'courier', 'kind': 'courier', 'at': at, 'loadout': ['weapon.bat', 'weapon.fists']},
            {'id': 'ped', 'kind': 'pedestrian', 'at': [11, 11], 'look': {'model': 'npc.civilian-woman-a'}}]


def infected(id, at, model, state='idle', yaw=0):
    return {'id': id, 'kind': 'infected', 'at': at, 'yaw': yaw, 'state': state, 'archetype': 'infected.sprinter', 'look': {'model': model}}


def write(name, spec):
    (OUT / f'{name}.json').write_text(json.dumps({'name': name, 'note': NOTE, 'ground': 'asphalt', 'time': 'golden', **spec}, indent=1) + '\n')


# Close pairs: chase (run/swing at the courier) and idle, player zoom 1 and 1.5.
for zoom, tag in ((1, 'z1'), (1.5, 'z1_5')):
    actors = cast([0, 3]) + [infected(f'z{k}', [-1.5 + k, -1.5], model, 'chase' if k < 2 else 'idle') for k, model in enumerate(MODELS * 2)]
    write(f'close-{tag}', {'size': 24, 'actors': actors, 'camera': {'mode': 'game', 'target': [0, 0], 'zoom': round(1 / zoom, 3)}, 'frames': 240, 'shots': [30, 90, 150, 210], 'sheet': 12})

# Motion strip: one of each walking past the camera (chase a courier far to the side), 12 cells.
actors = cast([9, 0]) + [infected('m0', [-6, -0.6], MODELS[0], 'chase', 90), infected('m1', [-6, 0.6], MODELS[1], 'chase', 90)]
write('strip', {'size': 30, 'actors': actors, 'camera': {'mode': 'follow', 'actor': 'm0', 'zoom': 0.5}, 'frames': 150, 'shots': [40, 80, 120], 'sheet': 12})

# 30-figure crowd sheet: 5 x 6 grid, alternating models, six headings.
actors = cast([0, 9]) + [infected(f'c{r * 6 + c}', [-3.75 + c * 1.5, -4 + r * 1.6], MODELS[(r + c) % 2], 'idle', [0, 45, 90, 135, 180, -90][(r * 6 + c) % 6]) for r in range(5) for c in range(6)]
write('crowd30', {'size': 30, 'actors': actors, 'camera': {'mode': 'game', 'target': [0, -0.8], 'zoom': 0.75}, 'frames': 90, 'shots': [90], 'sheet': 4})

# Blast: deaths, dismemberment caps and frozen corpse pages (permanent bodies), 10 s.
actors = cast([0, 8]) + [infected(f'b{k}', [round(2.2 * (k % 4) - 3.3, 2), -1 + 2 * (k // 4)], MODELS[k % 2], 'idle') for k in range(8)]
write('blast', {'size': 30, 'actors': actors, 'camera': {'mode': 'game', 'target': [0, 0], 'zoom': 0.6}, 'frames': 600, 'shots': [55, 75, 150, 600], 'sheet': 12,
                'script': [{'frame': 60, 'effect': {'blast': 'explosion.grenade', 'at': [0, 0]}}]})
