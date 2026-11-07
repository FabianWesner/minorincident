"""Single-model corpse close-ups from several angles: gen-corpse-one.py <asset>[=<archetype>] ... -> test-results/r2/one/<asset>-<angle>.json
Three bodies per spec (the ids pick the three death clips)."""
import json, os, sys
os.makedirs("test-results/r2/one", exist_ok=True)
views = {"side": [0, 1.2, 7.5], "top": [0, 8, 0.6], "iso": [4.5, 4.0, 5.0]}
for arg in sys.argv[1:]:
    asset, _, arche = arg.partition("=")
    arche = arche or "infected.runner"
    for name, pos in views.items():
        actors = [{"id": "courier", "kind": "courier", "at": [-9, 12], "state": "idle"}]
        script = []
        for k in range(3):
            ident = f"b{k}"
            actors.append({"id": ident, "kind": "infected", "archetype": arche, "at": [k * 3.0 - 3.0, 0], "state": "idle", "look": {"model": asset}})
            script.append({"frame": 5, "actor": ident, "do": {"corpse": True}})
        spec = {"name": f"one-{asset}-{name}", "seed": 22, "ground": "asphalt", "time": "L4", "size": 40, "dof": False, "actors": actors,
                "camera": {"mode": "pose", "position": [pos[0], pos[1], pos[2]], "target": [0, 0.2, 0]}, "frames": 82, "shots": [80], "sheet": 80, "script": script, "expect": {"consoleErrors": 0}}
        json.dump(spec, open(f"test-results/r2/one/{asset}-{name}.json", "w"), indent=1)
