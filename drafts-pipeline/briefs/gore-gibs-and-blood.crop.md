# Task: cut every item out of one concept sheet

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Input: `initial-drafts/gore-gibs-and-blood.png` (pack 20).
Write ONLY `assets/regions/gore-gibs-and-blood.json` and, per item, `assets/<asset id>/reference.png` + `assets/<asset id>/description.txt`.

For each item below, find its bounding box on the sheet (look at the image with view_image; use Python + Pillow to
crop and then LOOK at each crop to verify it). A good crop contains the whole item (all views, for characters) with a
small margin and no neighbouring item. Tiny labels may be included. Save the crop at original resolution.

Items:
- `gib.chunk-set`: Gib chunk set: 8 chunky low-poly shapes in reds and dark reds
- `gib.limb-generic`: Generic limb gibs: arm, leg, head, each with a stump cap
- `decal.blood-pool`: Large blood pool decal, top-down
- `decal.blood-trail`: Blood drag trail decal, top-down
- `decal.arterial-spray`: Arterial spray decal, top-down

`assets/regions/gore-gibs-and-blood.json` = {"sheet": "initial-drafts/gore-gibs-and-blood.png", "regions": {"<asset id>": [x0, y0, x1, y1], ...}}.
`description.txt` = the one-line item description below.
If an item is not on the sheet, skip it and report it.

Final message = exactly one JSON object:
{"sheet": "gore-gibs-and-blood.png", "cropped": ["<asset id>", ...], "missing": ["<asset id>", ...], "notes": "<one sentence>"}
