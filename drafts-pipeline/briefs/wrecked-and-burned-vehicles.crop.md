# Task: cut every item out of one concept sheet

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Input: `initial-drafts/wrecked-and-burned-vehicles.png` (pack 16).
Write ONLY `assets/regions/wrecked-and-burned-vehicles.json` and, per item, `assets/<asset id>/reference.png` + `assets/<asset id>/description.txt`.

For each item below, find its bounding box on the sheet (look at the image with view_image; use Python + Pillow to
crop and then LOOK at each crop to verify it). A good crop contains the whole item (all views, for characters) with a
small margin and no neighbouring item. Tiny labels may be included. Save the crop at original resolution.

Items:
- `veh.sedan-red.wrecked`: Red sedan, wrecked
- `veh.sedan-blue.wrecked`: Blue sedan, wrecked
- `veh.sedan-white.wrecked`: White sedan, wrecked
- `veh.suv-dark.wrecked`: Dark SUV, wrecked
- `veh.pickup-red.wrecked`: Red pickup, wrecked
- `veh.police-sedan.wrecked`: Police sedan, wrecked
- `veh.ambulance.wrecked`: Ambulance, wrecked
- `veh.school-bus.wrecked`: School bus, wrecked
- `veh.sedan-red.burned`: Red sedan, burned
- `veh.sedan-blue.burned`: Blue sedan, burned
- `veh.sedan-white.burned`: White sedan, burned
- `veh.suv-dark.burned`: Dark SUV, burned
- `veh.pickup-red.burned`: Red pickup, burned
- `veh.police-sedan.burned`: Police sedan, burned
- `veh.ambulance.burned`: Ambulance, burned
- `veh.school-bus.burned`: School bus, burned

`assets/regions/wrecked-and-burned-vehicles.json` = {"sheet": "initial-drafts/wrecked-and-burned-vehicles.png", "regions": {"<asset id>": [x0, y0, x1, y1], ...}}.
`description.txt` = the one-line item description below.
If an item is not on the sheet, skip it and report it.

Final message = exactly one JSON object:
{"sheet": "wrecked-and-burned-vehicles.png", "cropped": ["<asset id>", ...], "missing": ["<asset id>", ...], "notes": "<one sentence>"}
