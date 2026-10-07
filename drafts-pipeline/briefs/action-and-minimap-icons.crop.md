# Task: cut every item out of one concept sheet

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Input: `initial-drafts/action-and-minimap-icons.png` (pack 21).
Write ONLY `assets/regions/action-and-minimap-icons.json` and, per item, `assets/<asset id>/reference.png` + `assets/<asset id>/description.txt`.

For each item below, find its bounding box on the sheet (look at the image with view_image; use Python + Pillow to
crop and then LOOK at each crop to verify it). A good crop contains the whole item (all views, for characters) with a
small margin and no neighbouring item. Tiny labels may be included. Save the crop at original resolution.

Items:
- `ui.icon.actions`: About 30 action icons: melee swing, heavy smash, kick, dodge roll, sprint, pistol, shotgun, SMG, rifle, machine gun, rocket, frag, molotov, pipe bomb, lure, flashbang, medkit, bandage, soda, energy drink, shield bubble, ground slam, turret, corgi fetch, corgi bark, flashlight, lockpick, radio, keys, enter vehicle
- `ui.icon.minimap`: Minimap icons: player, corgi, objective, escort, safe zone, vehicle, infected, elite, loot

`assets/regions/action-and-minimap-icons.json` = {"sheet": "initial-drafts/action-and-minimap-icons.png", "regions": {"<asset id>": [x0, y0, x1, y1], ...}}.
`description.txt` = the one-line item description below.
If an item is not on the sheet, skip it and report it.

Final message = exactly one JSON object:
{"sheet": "action-and-minimap-icons.png", "cropped": ["<asset id>", ...], "missing": ["<asset id>", ...], "notes": "<one sentence>"}
