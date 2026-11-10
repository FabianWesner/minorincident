"""r32-animalmoves: Scene Lab fixtures for the L8 animal signature moves (night L8-zoo light).

Each scene: god-mode courier with the army MG at the origin; the animal(s) idle, walk in (chase), then the signature
special moves are triggered on the courier, then a short MG burst for hit reactions. `close` = side camera radius 9,
`game` = game camera zoom 1.5. Writes specs/scenes/r32-animalmoves/<animal>[-game].json.
  python3 tools/qa/r32/gen_specs.py
"""
import json, os

OUT = 'specs/scenes/r32-animalmoves'
os.makedirs(OUT, exist_ok=True)

ANIMALS = {
    # name: (archetype, count, start distance, [(frame, move)], fire frame, frames)
    'lion': ('infected.lion', 1, 14, [(150, 'lion.pounce'), (330, 'lion.pounce'), (520, 'lion.roar')], 640, 760),
    'lioness': ('infected.lioness', 1, 14, [(150, 'lion.flank'), (330, 'lion.pounce')], 520, 640),
    'flamingo': ('infected.flamingo', 6, 9, [(150, 'flamingo.dive'), (360, 'flamingo.dive')], 560, 680),
    'zebra': ('infected.zebra', 4, 16, [(150, 'zebra.stampede'), (380, 'zebra.kick')], 520, 640),
    'gorilla': ('infected.gorilla', 1, 9, [(150, 'gorilla.roar'), (300, 'gorilla.pound'), (450, 'gorilla.pound')], 600, 720),
    'elephant': ('infected.elephant', 1, 16, [(150, 'elephant.charge'), (400, 'elephant.swipe')], 560, 680),
    'monkey': ('infected.monkey', 4, 8, [(150, 'monkey.grab'), (330, 'monkey.debris')], 520, 640),
}

for name, (arch, count, dist, moves, fire, frames) in ANIMALS.items():
    actors = [{"id": "courier", "kind": "courier", "at": [0, 0], "yaw": 0, "loadout": ["weapon.bat", "weapon.army-mg"]}]
    ids = []
    for i in range(count):
        aid = 'z' if i == 0 else f'z{i}'
        ids.append(aid)
        actors.append({"id": aid, "kind": "infected", "archetype": arch, "at": [dist + (i % 2) * 1.2, (i - (count - 1) / 2) * 1.6], "yaw": 180, "state": "idle"})
    script = [{"frame": 40, "actor": a, "do": "chase"} for a in ids]
    for frame, move in moves:
        script.append({"frame": frame, "actor": "z", "do": {"special": move, "target": "courier"}})
    script.append({"frame": fire, "actor": "courier", "do": {"attack": "z", "seconds": 0.6, "side": "RIGHT"}})
    for cam, camera in (('close', {"mode": "pose", "position": [dist / 2, 3.2, 10], "target": [dist / 2, .7, 0]}), ('game', {"mode": "game", "target": "courier", "zoom": 1.5})):
        spec = {"name": f"r32-{name}" + ("-game" if cam == 'game' else ''),
                "note": f"r32-animalmoves {name}: walk-in 40, specials {', '.join(f'{m}@{f}' for f, m in moves)}, MG burst {fire}. Night L8-zoo light.",
                "seed": 3, "ground": "grass", "size": 50, "time": "L8-zoo", "dof": False,
                "actors": actors, "script": script, "camera": camera, "frames": frames, "trace": True,
                "expect": {"consoleErrors": 0}}
        with open(f'{OUT}/{name}{"-game" if cam == "game" else ""}.json', 'w') as f:
            json.dump(spec, f, indent=1)
print('wrote', OUT)
