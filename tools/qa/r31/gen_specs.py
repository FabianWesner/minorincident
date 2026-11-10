"""r31-zombie-audit: one isolated motion fixture per infected type (Scene Lab).

Timeline (60 Hz): 0-120 idle (asset streaming + idle read); 120-420 it chases the god-mode courier and attacks her;
420 a short army-MG burst (bullet hit reactions); 510 a bat swing (melee hit); 600 a heavy kick (knockdown/get-up);
780-960 a long MG burst (death, or repeated bullet hits on bosses); end 1080. Close camera from the side.
python3 tools/qa/r31/gen_specs.py  -> specs/scenes/r31-zombie-audit/*.json (close) and */game/*.json (game camera zoom 1.5)
"""
import json, os, pathlib

OUT = pathlib.Path(__file__).resolve().parents[3] / 'specs/scenes/r31-zombie-audit'
TYPES = [
    # id, archetype, extra actor fields, start distance
    ('suit-l4', 'infected.firefighter', {'look': {'model': 'inf.common-worker'}}, 9),
    ('native-bbqdad', 'infected.firefighter', {'look': {'model': 'inf.bbq-dad'}}, 9),
    ('civ-man', 'infected.runner', {'look': {'model': 'npc.civilian-man-a', 'tier': 'average'}}, 9),
    ('civ-elderly', 'infected.runner', {'look': {'model': 'npc.civilian-elderly', 'tier': 'frail'}}, 7),
    ('guard', 'infected.runner', {'look': {'model': 'npc.national-guard', 'tier': 'athletic'}}, 9),
    ('riot', 'infected.riot', {}, 9),
    ('firefighter', 'infected.firefighter', {}, 9),
    ('hazmat', 'infected.hazmat', {}, 9),
    ('nurse', 'infected.nurse', {}, 9),
    ('crawler', 'infected.crawler', {}, 6),
    ('role-brute', 'infected.brute', {'allowRigid': True}, 9),
    ('role-armored', 'infected.armored', {'allowRigid': True}, 9),
    ('role-butcher', 'infected.butcher', {'allowRigid': True}, 9),
    ('role-sprinter', 'infected.sprinter', {'allowRigid': True}, 9),
    ('role-screamer', 'infected.screamer', {'allowRigid': True}, 9),
    ('role-bloated', 'infected.bloated', {'allowRigid': True}, 9),
    ('alpha-brute', 'infected.alpha', {'alphaType': 'brute'}, 10),
    ('alpha-thrower', 'infected.alpha', {'alphaType': 'thrower'}, 10),
    ('alpha-screamer', 'infected.alpha', {'alphaType': 'screamer'}, 10),
    ('alpha-leaper', 'infected.alpha', {'alphaType': 'leaper'}, 12),
    ('alpha-armoured', 'infected.alpha', {'alphaType': 'armoured'}, 10),
    ('mega', 'infected.alpha', {'look': {'model': 'inf.mega-alpha'}}, 12),
    ('dog', 'infected.dog', {}, 9),
    ('lion', 'infected.lion', {}, 12),
    ('lioness', 'infected.lioness', {}, 12),
    ('gorilla', 'infected.gorilla', {}, 10),
    ('elephant', 'infected.elephant', {}, 14),
    ('zebra', 'infected.zebra', {}, 12),
    ('flamingo', 'infected.flamingo', {}, 9),
    ('monkey', 'infected.monkey', {}, 9),
]


def spec(name, archetype, extra, dist, camera):
    big = archetype in ('infected.elephant', 'infected.gorilla') or 'mega' in name
    actor = {'id': 'z', 'kind': 'infected', 'archetype': archetype, 'at': [dist, 0], 'yaw': 180, 'state': 'idle', **extra}
    return {
        'name': f'r31-{name}' + ('' if camera == 'close' else '-game'),
        'note': 'r31-zombie-audit motion fixture: idle 0-120, chase+attack 120-420, MG burst 420, bat 510, heavy kick 600, long MG 780-960.',
        'seed': 3, 'ground': 'asphalt', 'size': 40, 'time': 'L4', 'dof': False,
        'actors': [
            {'id': 'courier', 'kind': 'courier', 'at': [0, 0], 'yaw': 0, 'loadout': ['weapon.bat', 'weapon.army-mg']},
            actor,
        ],
        'script': [
            {'frame': 120, 'actor': 'z', 'do': 'chase'},
            {'frame': 420, 'actor': 'courier', 'do': {'attack': 'z', 'seconds': 0.15, 'side': 'RIGHT'}},
            {'frame': 510, 'actor': 'courier', 'do': {'attack': 'z', 'seconds': 0.5, 'side': 'LEFT'}},
            {'frame': 600, 'actor': 'z', 'do': {'hit': {'from': 'courier', 'heavy': True}}},
            {'frame': 780, 'actor': 'courier', 'do': {'attack': 'z', 'seconds': 3, 'side': 'RIGHT'}},
        ] + ([{'frame': f, 'camera': {'mode': 'close', 'target': 'z', 'radius': 7 if not big else 11, 'azimuth': 0}} for f in range(606, 1080, 12)] if camera == 'close' else []),
        'camera': ({'mode': 'close', 'target': [1.2, 0.9 if not big else 1.6, 0], 'radius': 7 if not big else 11, 'azimuth': 0}
                   if camera == 'close' else {'mode': 'game', 'target': 'z', 'zoom': 1.5}),
        'frames': 1080, 'trace': True,
        'expect': {'consoleErrors': 0},
    }


def main():
    for camera, sub in (('close', OUT), ('game', OUT / 'game')):
        sub.mkdir(parents=True, exist_ok=True)
        for name, archetype, extra, dist in TYPES:
            (sub / f'{name}.json').write_text(json.dumps(spec(name, archetype, extra, dist, camera), indent=1) + '\n')
    print(len(TYPES), 'types ->', OUT)


if __name__ == '__main__':
    main()
