# Task: upscale one concept-sheet item into a clean modeling reference

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Work ONLY inside `assets/int.gym-cafeteria/`.

Input: `assets/int.gym-cafeteria/reference.png` — a crop of one item (School gym and cafeteria interior cutaway: basketball court with hoops, folding tables, cots for evacuees) from the concept sheet
`initial-drafts/interiors.png`. Output: `assets/int.gym-cafeteria/reference-upscaled.png` and `assets/int.gym-cafeteria/prompt.md`.

Use the built-in imagegen tool in edit mode (load reference.png with view_image first; also load the full sheet
for style context). Produce a high-resolution, clean reference of THE SAME item:
- Same design, proportions, colours, markings and camera angle. Do not redesign; only clarify.
- Same stylized chunky low-poly toy look as the sheet (warm saturated colours, soft golden-hour light, slight bevels).
- Isolated: only this item, centred, fully in frame with a margin; remove labels, panel borders and neighbours.
- Background: plain neutral dark grey (#2a2730), no shadow clutter (as specified in specs/03-asset-pipeline.md §3).
- Isolated building/kit reconstructed from the crop: whole structure fully visible from the same three-quarter isometric angle, ground trimmed to its footprint, no neighbouring buildings, cars or people. Keep design, colours and signage (no real brands; town = Sunset Grove).
Generate once; regenerate once only if clearly wrong. Copy the chosen file from $CODEX_HOME/generated_images.
Write the prompt you used, the tool and today's date into prompt.md.

Final message = exactly one JSON object:
{"id": "int.gym-cafeteria", "output": "assets/int.gym-cafeteria/reference-upscaled.png", "width": <px>, "height": <px>, "attempts": <n>, "notes": "<one sentence>"}
