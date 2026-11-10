"""r32-alphas: Scene Lab fixtures, one per Alpha type x move, close side camera (day + night) and game camera zoom 1.5.
python3 tools/qa/r32/gen_alpha_specs.py  ->  specs/scenes/r32-alphas/*.json
The courier stands at the origin in god mode; the Alpha faces her and starts the move by the scripted shared scheduler
command at frame 0 (the same startSpecial the AI uses). `strike` lets a Brute chase from 3 m for its ordinary attack."""
import json, os

OUT = 'specs/scenes/r32-alphas'
os.makedirs(OUT, exist_ok=True)
# type, move, alpha distance, frames, extra actors, extra script
MOVES = [
    ('brute', 'alpha.charge', 8, 200, [], []),
    ('brute', 'alpha.ground-slam', 3, 200, [], []),
    ('brute', 'alpha.grab-human', 2, 220, [], []),
    ('leaper', 'strike', 3.2, 200, [], []),
    ('thrower', 'alpha.living-missile', 8, 240, [{'id': 'm', 'kind': 'infected', 'archetype': 'infected.runner', 'at': [8.6, .8], 'yaw': 180, 'state': 'idle'}], []),
    ('thrower', 'alpha.grab-throw', 8, 240, [{'id': 'c', 'kind': 'infected', 'archetype': 'infected.runner', 'at': [8.8, .6], 'yaw': 90, 'state': {'corpse': True}}], []),
    ('screamer', 'alpha.roar', 4, 200, [{'id': f'r{i}', 'kind': 'infected', 'archetype': 'infected.runner', 'at': [12 + i % 2, -4 + 2 * i], 'yaw': 180, 'state': 'idle'} for i in range(4)], []),
    ('screamer', 'roar-interrupted', 4, 160, [], [{'frame': 22, 'actor': 'courier', 'do': {'attack': 'z', 'seconds': .4, 'side': 'RIGHT'}}]),
    ('leaper', 'alpha.pounce', 10, 200, [], []),
    ('armoured', 'alpha.shield-bash', 2, 180, [], []),
]

def spec(alpha, move, dist, frames, extra, script, variant):
    night = variant.endswith('night')
    game = variant.startswith('game')
    actors = [
        {'id': 'courier', 'kind': 'courier', 'at': [0, 0], 'yaw': 0, 'loadout': ['weapon.bat', 'weapon.army-mg']},
        {'id': 'z', 'kind': 'infected', 'archetype': 'infected.alpha', 'at': [dist, 0], 'yaw': 180, 'state': 'idle', 'alphaType': alpha},
    ] + extra
    steps = list(script)
    real = move.startswith('alpha.')
    if real:
        steps.append({'frame': 0, 'actor': 'z', 'do': {'special': move, 'target': 'courier'}})
    elif move == 'strike':
        steps.append({'frame': 10, 'actor': 'z', 'do': 'chase'})
    else:  # interrupted roar: the courier's MG hits it during the inhale
        steps.append({'frame': 0, 'actor': 'z', 'do': {'special': 'alpha.roar', 'target': 'courier'}})
    cx = dist / 2 if move in ('alpha.charge', 'alpha.pounce', 'alpha.living-missile', 'alpha.grab-throw') else dist * .6
    camera = {'mode': 'game', 'target': [cx, 0], 'zoom': 1.5} if game else {'mode': 'close', 'target': [cx, 1.1, 0], 'radius': 15 if dist > 5 else 9, 'azimuth': 0}
    name = f"r32-{alpha}-{move.replace('alpha.', '')}-{variant}"
    return name, {
        'name': name,
        'note': f'r32-alphas: {alpha} Alpha, {move}; courier god mode at the origin; {variant}.',
        'seed': 3, 'ground': 'asphalt', 'size': 40, 'time': 'night' if night else 'L4', 'dof': False,
        'actors': actors, 'script': sorted(steps, key=lambda s: s['frame']),
        'camera': camera, 'frames': frames, 'trace': True,
        'expect': {'consoleErrors': 0},
    }

for alpha, move, dist, frames, extra, script in MOVES:
    for variant in ('close-day', 'close-night') + (('game-day', 'game-night') if move in ('alpha.charge', 'alpha.living-missile', 'alpha.roar', 'alpha.pounce', 'alpha.shield-bash', 'strike', 'alpha.ground-slam') else ()):
        name, data = spec(alpha, move, dist, frames, extra, script, variant)
        with open(f'{OUT}/{name}.json', 'w') as f:
            json.dump(data, f, indent=1)
print(len(os.listdir(OUT)), 'specs')
