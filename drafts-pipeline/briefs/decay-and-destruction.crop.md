# Task: cut every item out of one concept sheet

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Input: `initial-drafts/decay-and-destruction.png` (pack 19).
Write ONLY `assets/regions/decay-and-destruction.json` and, per item, `assets/<asset id>/reference.png` + `assets/<asset id>/description.txt`.

For each item below, find its bounding box on the sheet (look at the image with view_image; use Python + Pillow to
crop and then LOOK at each crop to verify it). A good crop contains the whole item (all views, for characters) with a
small margin and no neighbouring item. Tiny labels may be included. Save the crop at original resolution.

Items:
- `decay.dropped-belongings`: Dropped belongings: suitcases, bag, phone, stroller
- `decay.broken-glass`: Broken glass shards pile
- `decay.boarded-windows`: Boarded-up house window and shop window
- `decay.furniture-barricade`: Furniture barricade: sofa, fridge, planks
- `decay.burned-facade.house`: Burned house facade module
- `decay.burned-facade.brick`: Burned brick shop facade module
- `decay.burned-facade.diner`: Burned diner facade module
- `decay.burned-facade.school`: Burned school facade module
- `decay.collapsed-facade`: Collapsed building facade
- `decay.rubble-pile`: Rubble piles small, medium, large
- `decay.downed-power-line`: Downed power line with sparks
- `decay.fallen-tree`: Fallen tree across a road
- `decay.crater`: Explosion crater
- `decay.body-bag`: Body bags
- `decay.abandoned-checkpoint`: Abandoned checkpoint: knocked-over tent, scattered barriers
- `decay.graffiti`: Graffiti panels: STAY OUT, ALIVE INSIDE, SG with a cross

`assets/regions/decay-and-destruction.json` = {"sheet": "initial-drafts/decay-and-destruction.png", "regions": {"<asset id>": [x0, y0, x1, y1], ...}}.
`description.txt` = the one-line item description below.
If an item is not on the sheet, skip it and report it.

Final message = exactly one JSON object:
{"sheet": "decay-and-destruction.png", "cropped": ["<asset id>", ...], "missing": ["<asset id>", ...], "notes": "<one sentence>"}
