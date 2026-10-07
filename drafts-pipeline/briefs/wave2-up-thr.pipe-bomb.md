# Task: upscale one concept-sheet item into a clean modeling reference

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Work ONLY inside `assets/thr.pipe-bomb/`.

Input: `assets/thr.pipe-bomb/reference.png` — a crop of one item (Pipe bomb) from the concept sheet
`initial-drafts/weapons-consumables-and-survival-props.png`. Output: `assets/thr.pipe-bomb/reference-upscaled.png` and `assets/thr.pipe-bomb/prompt.md`.

Use the built-in imagegen tool in edit mode (load reference.png with view_image first; also load the full sheet
for style context). Produce a high-resolution, clean reference of THE SAME item:
- Same design, proportions, colours, markings and camera angle. Do not redesign; only clarify.
- Same stylized chunky low-poly toy look as the sheet (warm saturated colours, soft golden-hour light, slight bevels).
- Isolated: only this item, centred, fully in frame with a margin; remove labels, panel borders and neighbours.
- Background: plain neutral dark grey (#2a2730), no shadow clutter (as specified in specs/03-asset-pipeline.md §3).
- Single object, three-quarter isometric view from front-right at about 30 degrees elevation.
Generate once; regenerate once only if clearly wrong. Copy the chosen file from $CODEX_HOME/generated_images.
Write the prompt you used, the tool and today's date into prompt.md.

Final message = exactly one JSON object:
{"id": "thr.pipe-bomb", "output": "assets/thr.pipe-bomb/reference-upscaled.png", "width": <px>, "height": <px>, "attempts": <n>, "notes": "<one sentence>"}
