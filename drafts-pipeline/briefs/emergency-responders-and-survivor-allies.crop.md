# Task: cut every item out of one concept sheet

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Input: `initial-drafts/emergency-responders-and-survivor-allies.png` (pack 12).
Write ONLY `assets/regions/emergency-responders-and-survivor-allies.json` and, per item, `assets/<asset id>/reference.png` + `assets/<asset id>/description.txt`.

For each item below, find its bounding box on the sheet (look at the image with view_image; use Python + Pillow to
crop and then LOOK at each crop to verify it). A good crop contains the whole item (all views, for characters) with a
small margin and no neighbouring item. Tiny labels may be included. Save the crop at original resolution.

Items:
- `npc.police-officer`: Police officer (alive): navy uniform, vest, cap, radio
- `npc.paramedic`: Paramedic (alive): EMS uniform with reflective stripes, med bag
- `npc.firefighter-alive`: Firefighter (alive): turnout gear, helmet, air tank
- `npc.national-guard`: National Guard soldier: camo, helmet, vest, rifle slung
- `npc.survivor-ally-mechanic`: Survivor ally 1: mechanic woman, overalls, wrench
- `npc.survivor-ally-hunter`: Survivor ally 2: older man, hunting cap, plaid jacket, walkie-talkie
- `npc.survivor-ally-teen`: Survivor ally 3: teen with skateboard and slingshot

`assets/regions/emergency-responders-and-survivor-allies.json` = {"sheet": "initial-drafts/emergency-responders-and-survivor-allies.png", "regions": {"<asset id>": [x0, y0, x1, y1], ...}}.
`description.txt` = the one-line item description below.
If an item is not on the sheet, skip it and report it.

Final message = exactly one JSON object:
{"sheet": "emergency-responders-and-survivor-allies.png", "cropped": ["<asset id>", ...], "missing": ["<asset id>", ...], "notes": "<one sentence>"}
