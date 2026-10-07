# Task: cut every item out of one concept sheet

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Input: `initial-drafts/heavy-weapons-throwables-and-abilities.png` (pack 14).
Write ONLY `assets/regions/heavy-weapons-throwables-and-abilities.json` and, per item, `assets/<asset id>/reference.png` + `assets/<asset id>/description.txt`.

For each item below, find its bounding box on the sheet (look at the image with view_image; use Python + Pillow to
crop and then LOOK at each crop to verify it). A good crop contains the whole item (all views, for characters) with a
small margin and no neighbouring item. Tiny labels may be included. Save the crop at original resolution.

Items:
- `wpn.knife`: Combat knife
- `wpn.fire-axe`: Red fire axe
- `wpn.katana`: Katana with wrapped grip
- `wpn.smg`: Compact SMG
- `wpn.hunting-rifle`: Wooden hunting rifle with scope
- `wpn.assault-rifle`: Assault rifle
- `wpn.machine-gun`: Light machine gun with box magazine
- `wpn.rocket-launcher`: Shoulder rocket launcher
- `proj.rocket`: Rocket projectile
- `thr.frag-grenade`: Frag grenade
- `thr.flashbang`: Flashbang
- `abl.shield-bubble`: Ability: glowing protective shield dome
- `abl.ground-slam`: Ability: ground slam shockwave ring with cracks
- `abl.turret`: Ability: deployable scrap-built tripod turret

`assets/regions/heavy-weapons-throwables-and-abilities.json` = {"sheet": "initial-drafts/heavy-weapons-throwables-and-abilities.png", "regions": {"<asset id>": [x0, y0, x1, y1], ...}}.
`description.txt` = the one-line item description below.
If an item is not on the sheet, skip it and report it.

Final message = exactly one JSON object:
{"sheet": "heavy-weapons-throwables-and-abilities.png", "cropped": ["<asset id>", ...], "missing": ["<asset id>", ...], "notes": "<one sentence>"}
