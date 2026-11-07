"""Generate tests/scenes/catalog/corpse-sweep*.json: every corpse variant for pose/skin review (r2-corpse).
Usage: gen-corpse-sweep.py  -> corpse-sweep.json (game camera, 4x4 grid) and corpse-side-<n>.json (side-on line-ups)."""
import json
models = [("alpha", "infected.alpha", "inf.alpha"), ("alpha-suit", "infected.alpha", "inf.alpha-suit"), ("alpha-hoodie", "infected.alpha", "inf.alpha-hoodie"),
          ("alpha-worker", "infected.alpha", "inf.alpha-worker"), ("alpha-fire", "infected.alpha", "inf.alpha-fire"),
          ("runner", "infected.runner", None), ("worker", "infected.runner", "inf.common-worker"),
          ("mom", "infected.runner", "inf.suburban-mom"), ("firefighter", "infected.firefighter", None),
          ("riot", "infected.runner", "inf.riot-cop"), ("hazmat", "infected.hazmat", None), ("crawler", "infected.crawler", None), ("dog", "infected.dog", None),
          ("nurse", "infected.runner", "inf.nurse"),
          ("elderly", "infected.runner", "npc.civilian-elderly"), ("mega", "infected.alpha", "inf.mega-alpha")]


def build(name, rows, camera, note, copies=1):
    actors = [{"id": "courier", "kind": "courier", "at": [-9, 12], "state": "idle"}]
    script = []
    for r, group in enumerate(rows):
        for c, (n, a, m) in enumerate(group):
            for k in range(copies):
                ident = f"{n}-{k}" if copies > 1 else n
                d = {"id": ident, "kind": "infected", "archetype": a, "at": [-7 + c * 2.4 + 0.0, -4 + r * 4.0 + k * 1.2], "state": "idle"}
                if m:
                    d["look"] = {"model": m}
                actors.append(d)
                script.append({"frame": 5, "actor": ident, "do": {"corpse": True}})
    return {"name": name, "note": note, "seed": 22, "ground": "asphalt", "time": "L4", "size": 60, "dof": False, "actors": actors, "camera": camera,
            "frames": 82, "shots": [80], "sheet": 80, "script": script, "expect": {"consoleErrors": 0}}


def dump(spec):
    json.dump(spec, open(f"tests/scenes/catalog/{spec['name']}.json", "w"), indent=1)


rows = [models[i:i + 4] for i in range(0, len(models), 4)]
dump(build("corpse-sweep", rows, {"mode": "pose", "position": [0, 15, 10], "target": [0, 0, 2.0]}, "r2-corpse: every corpse variant in one grid."))
# Side-on strips: one model per row, three copies each (ids pick the death pose), viewed along z from the south.
for n in range(0, len(models), 4):
    group = models[n:n + 4]
    spec = build(f"corpse-side-{n // 4}", [], {"mode": "pose", "position": [0, 1.0, 14], "target": [0, 0.5, 0]}, "r2-corpse: side-on, three ids per model.")
    for r, (nm, a, m) in enumerate(group):
        for k in range(3):
            ident = f"{nm}-{k}"
            d = {"id": ident, "kind": "infected", "archetype": a, "at": [-5 + (r * 3 + k) * 1.6, 0], "state": "idle"}
            if m:
                d["look"] = {"model": m}
            spec["actors"].append(d)
            spec["script"].append({"frame": 5, "actor": ident, "do": {"corpse": True}})
    dump(spec)
# Game-camera sweeps for the quality x zoom x backend matrix: one grid at zoom 0.5, four rows of four at zoom 1.5.
dump(build("corpse-z05", rows, {"mode": "game", "target": [0, 0.2, 2.0], "zoom": 0.5}, "r2-corpse: all variants, game camera zoom 0.5."))
for g in range(0, len(models), 4):
    spec = build(f"corpse-z15-{g // 4}", [], {"mode": "game", "target": [0, 0.2, 0], "zoom": 1.5}, "r2-corpse: four variants, game camera zoom 1.5.")
    for c, (nm, a, m) in enumerate(models[g:g + 4]):
        d = {"id": nm, "kind": "infected", "archetype": a, "at": [-4.2 + c * 2.8, 0], "state": "idle"}
        if m:
            d["look"] = {"model": m}
        spec["actors"].append(d)
        spec["script"].append({"frame": 5, "actor": nm, "do": {"corpse": True}})
    dump(spec)
