# Task: cut every item out of one concept sheet

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Input: `initial-drafts/living-civilians-and-story-npcs.png` (pack 11).
Write ONLY `assets/regions/living-civilians-and-story-npcs.json` and, per item, `assets/<asset id>/reference.png` + `assets/<asset id>/description.txt`.

For each item below, find its bounding box on the sheet (look at the image with view_image; use Python + Pillow to
crop and then LOOK at each crop to verify it). A good crop contains the whole item (all views, for characters) with a
small margin and no neighbouring item. Tiny labels may be included. Save the crop at original resolution.

Items:
- `npc.civilian-man-a`: Civilian man A: polo shirt, khakis, sneakers (healthy version of the runner body)
- `npc.civilian-man-b`: Civilian man B: hoodie, jeans, cap
- `npc.civilian-woman-a`: Civilian woman A: sundress with cardigan, tote bag
- `npc.civilian-woman-b`: Civilian woman B: office blouse, slacks, lanyard
- `npc.civilian-kid`: Civilian kid, about 8: t-shirt, shorts, sneakers
- `npc.civilian-elderly`: Elderly man: sweater vest, flat cap, cane
- `npc.patient-zero-courier`: Patient Zero courier in three states side by side: healthy, sick (pale, sweating), infected; delivery uniform
- `prop.medical-cooler`: Medical courier cooler: white and orange, biohazard sticker, handle
- `npc.brother`: The survivor's brother, about 10: backpack, baseball cap, hoodie
- `npc.mrs-alvarez`: Mrs. Alvarez, elderly neighbor: cardigan, glasses, gardening apron
- `npc.helicopter-pilot`: Rescue helicopter pilot: flight suit, helmet with visor

`assets/regions/living-civilians-and-story-npcs.json` = {"sheet": "initial-drafts/living-civilians-and-story-npcs.png", "regions": {"<asset id>": [x0, y0, x1, y1], ...}}.
`description.txt` = the one-line item description below.
If an item is not on the sheet, skip it and report it.

Final message = exactly one JSON object:
{"sheet": "living-civilians-and-story-npcs.png", "cropped": ["<asset id>", ...], "missing": ["<asset id>", ...], "notes": "<one sentence>"}
