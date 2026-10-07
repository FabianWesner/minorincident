# Task: cut every item out of one concept sheet

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Input: `initial-drafts/{{FILE}}` (pack {{PACK}}).
Write ONLY `assets/regions/{{STEM}}.json` and, per item, `assets/<asset id>/reference.png` + `assets/<asset id>/description.txt`.

For each item below, find its bounding box on the sheet (look at the image with view_image; use Python + Pillow to
crop and then LOOK at each crop to verify it). A good crop contains the whole item (all views, for characters) with a
small margin and no neighbouring item. Tiny labels may be included. Save the crop at original resolution.

Items:
{{ITEMS}}

`assets/regions/{{STEM}}.json` = {"sheet": "initial-drafts/{{FILE}}", "regions": {"<asset id>": [x0, y0, x1, y1], ...}}.
`description.txt` = the one-line item description below.
If an item is not on the sheet, skip it and report it.

Final message = exactly one JSON object:
{"sheet": "{{FILE}}", "cropped": ["<asset id>", ...], "missing": ["<asset id>", ...], "notes": "<one sentence>"}
