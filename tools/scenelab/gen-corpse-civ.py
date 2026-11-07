"""Generate tests/scenes/catalog/corpse-civilians.json: killed civilians (the CivilianCrowd corpse layer, clip death-side)."""
import json
models = ["npc.civilian-woman-a", "npc.civilian-man-b", "npc.civilian-woman-b", "npc.police-officer", "npc.national-guard", "npc.civilian-man-a",
          "npc.civilian-elderly", "npc.civilian-kid"]
actors = [{"id": "courier", "kind": "courier", "at": [-9, 12], "state": "idle"}]
script = []
for i, m in enumerate(models):
    ident = f"civ-{i}"
    actors.append({"id": ident, "kind": "pedestrian", "at": [-5 + (i % 4) * 3.4, -2 + (i // 4) * 3.6], "look": {"model": m}})
    script.append({"frame": 5, "actor": ident, "do": {"corpse": True}})
spec = {"name": "corpse-civilians", "note": "r2-corpse: killed civilians frozen in the permanent-corpse layer (elderly, officer, guard, kid).", "seed": 22, "ground": "asphalt",
        "time": "L4", "size": 60, "dof": False, "actors": actors, "camera": {"mode": "pose", "position": [0, 12, 8], "target": [0, 0, 0.5]}, "frames": 200, "shots": [190], "sheet": 190,
        "script": script, "expect": {"consoleErrors": 0}}
json.dump(spec, open("tests/scenes/catalog/corpse-civilians.json", "w"), indent=1)
