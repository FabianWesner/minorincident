# Task: cut every item out of one concept sheet

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Input: `initial-drafts/highway-helipad-and-safe-zone.png` (pack 18).
Write ONLY `assets/regions/highway-helipad-and-safe-zone.json` and, per item, `assets/<asset id>/reference.png` + `assets/<asset id>/description.txt`.

For each item below, find its bounding box on the sheet (look at the image with view_image; use Python + Pillow to
crop and then LOOK at each crop to verify it). A good crop contains the whole item (all views, for characters) with a
small margin and no neighbouring item. Tiny labels may be included. Save the crop at original resolution.

Items:
- `kit.highway-onramp.ramp`: Highway on-ramp segment with guard rails
- `kit.highway-onramp.sign`: Overhead green highway sign gantry
- `bld.helipad`: Helipad with H marking and landing lights
- `bld.helipad.windsock`: Windsock on a pole
- `bld.helipad.flare-stand`: Flare stand
- `bld.civic-center`: Civic center: safe-zone main building, gym-type hall, SAFE ZONE banners, sandbags at the entrance

`assets/regions/highway-helipad-and-safe-zone.json` = {"sheet": "initial-drafts/highway-helipad-and-safe-zone.png", "regions": {"<asset id>": [x0, y0, x1, y1], ...}}.
`description.txt` = the one-line item description below.
If an item is not on the sheet, skip it and report it.

Final message = exactly one JSON object:
{"sheet": "highway-helipad-and-safe-zone.png", "cropped": ["<asset id>", ...], "missing": ["<asset id>", ...], "notes": "<one sentence>"}
