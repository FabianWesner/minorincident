# Task: cut every item out of one concept sheet

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Input: `initial-drafts/survivor-gear-tiers-and-action-poses.png` (pack 13).
Write ONLY `assets/regions/survivor-gear-tiers-and-action-poses.json` and, per item, `assets/<asset id>/reference.png` + `assets/<asset id>/description.txt`.

For each item below, find its bounding box on the sheet (look at the image with view_image; use Python + Pillow to
crop and then LOOK at each crop to verify it). A good crop contains the whole item (all views, for characters) with a
small margin and no neighbouring item. Tiny labels may be included. Save the crop at original resolution.

Items:
- `char.survivor-male.gear-t1`: Male survivor tier 1: backpack with duct tape
- `char.survivor-male.gear-t2`: Male survivor tier 2: knee and elbow pads, thigh holster
- `char.survivor-male.gear-t3`: Male survivor tier 3: padded vest, cap
- `char.survivor-male.gear-t4`: Male survivor tier 4: heavy vest, ammo belts, gas mask
- `char.survivor-female.gear-t1`: Female survivor tier 1: backpack with duct tape
- `char.survivor-female.gear-t2`: Female survivor tier 2: knee and elbow pads, thigh holster
- `char.survivor-female.gear-t3`: Female survivor tier 3: padded vest, cap
- `char.survivor-female.gear-t4`: Female survivor tier 4: heavy vest, ammo belts, gas mask
- `char.survivor.pose-kick`: Pose: front kick
- `char.survivor.pose-throw`: Pose: grenade throw arc
- `char.survivor.pose-rifle`: Pose: two-hand rifle aim
- `char.survivor.pose-heavy`: Pose: carrying a heavy weapon (machine gun)
- `char.survivor.pose-driving`: Pose: seated driving

`assets/regions/survivor-gear-tiers-and-action-poses.json` = {"sheet": "initial-drafts/survivor-gear-tiers-and-action-poses.png", "regions": {"<asset id>": [x0, y0, x1, y1], ...}}.
`description.txt` = the one-line item description below.
If an item is not on the sheet, skip it and report it.

Final message = exactly one JSON object:
{"sheet": "survivor-gear-tiers-and-action-poses.png", "cropped": ["<asset id>", ...], "missing": ["<asset id>", ...], "notes": "<one sentence>"}
