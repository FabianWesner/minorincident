# Task: cut every item out of one concept sheet

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Input: `initial-drafts/heavy-and-special-vehicles.png` (pack 15).
Write ONLY `assets/regions/heavy-and-special-vehicles.json` and, per item, `assets/<asset id>/reference.png` + `assets/<asset id>/description.txt`.

For each item below, find its bounding box on the sheet (look at the image with view_image; use Python + Pillow to
crop and then LOOK at each crop to verify it). A good crop contains the whole item (all views, for characters) with a
small margin and no neighbouring item. Tiny labels may be included. Save the crop at original resolution.

Items:
- `veh.courier-van`: Medical courier van: white with teal stripe, roof rack
- `veh.military-truck`: Military cargo truck: olive drab, canvas cover
- `veh.box-truck`: Box truck: white box, moving-company stripe
- `veh.semi-trailer`: Semi truck with long trailer
- `veh.helicopter`: Rescue helicopter: red and white, skids, searchlight
- `veh.train-boxcar`: Freight train boxcar, rust red
- `veh.train-tanker`: Freight train tank wagon, black
- `veh.train-flatcar`: Freight train flatcar with containers

`assets/regions/heavy-and-special-vehicles.json` = {"sheet": "initial-drafts/heavy-and-special-vehicles.png", "regions": {"<asset id>": [x0, y0, x1, y1], ...}}.
`description.txt` = the one-line item description below.
If an item is not on the sheet, skip it and report it.

Final message = exactly one JSON object:
{"sheet": "heavy-and-special-vehicles.png", "cropped": ["<asset id>", ...], "missing": ["<asset id>", ...], "notes": "<one sentence>"}
