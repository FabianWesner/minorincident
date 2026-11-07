"""Live death-clip sheet: gen-corpse-fall.py <asset> [archetype] -> test-results/r2/fall-<asset>.json (contact sheet every 3 frames)."""
import json, os, sys
asset = sys.argv[1]
arche = sys.argv[2] if len(sys.argv) > 2 else "infected.runner"
os.makedirs("test-results/r2", exist_ok=True)
actors = [{"id": "courier", "kind": "courier", "at": [-9, 12], "state": "idle"}]
script = []
for k in range(3):
    actors.append({"id": f"b{k}", "kind": "infected", "archetype": arche, "at": [k * 3.0 - 3.0, 0], "state": "idle", "look": {"model": asset}})
    script.append({"frame": 5, "actor": f"b{k}", "do": {"corpse": True, "ageTicks": 0}})
spec = {"name": f"fall-{asset}", "seed": 22, "ground": "asphalt", "time": "L4", "size": 40, "dof": False, "actors": actors,
        "camera": {"mode": "pose", "position": [0, 5, 9], "target": [0, 0.5, 0]}, "frames": 80, "shots": [], "sheet": 3, "script": script, "expect": {"consoleErrors": 0}}
json.dump(spec, open(f"test-results/r2/fall-{asset}.json", "w"), indent=1)
