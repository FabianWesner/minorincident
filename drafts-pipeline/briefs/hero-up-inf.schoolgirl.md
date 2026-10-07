# Task: upscale one concept-sheet item into a clean modeling reference

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Work ONLY inside `assets/inf.schoolgirl/`.

Input: `assets/inf.schoolgirl/reference.png` — a crop of one item (Infected schoolgirl (Runner): school uniform, pigtails, bloody, glowing red eyes) from the concept sheet
`initial-drafts/zombies-civilian-characters.png`. Output: `assets/inf.schoolgirl/reference-upscaled.png` and `assets/inf.schoolgirl/prompt.md`.

Use the built-in imagegen tool in edit mode (load reference.png with view_image first; also load the full sheet
for style context). Produce a high-resolution, clean reference of THE SAME item:
- Same design, proportions, colours, markings and camera angle. Do not redesign; only clarify.
- Same stylized chunky low-poly toy look as the sheet (warm saturated colours, soft golden-hour light, slight bevels).
- Isolated: only this item, centred, fully in frame with a margin; remove labels, panel borders and neighbours.
- Background: plain neutral dark grey (#2a2730), no shadow clutter (as specified in specs/03-asset-pipeline.md §3).
- Character turnaround on one image: front, left side, back and three-quarter views side by side, same scale, relaxed stance with arms slightly away from the body (specs/03 §3). Keep the exact outfit, colours, hair and proportions of the sheet.
Generate once; regenerate once only if clearly wrong. Copy the chosen file from $CODEX_HOME/generated_images.
Write the prompt you used, the tool and today's date into prompt.md.

Final message = exactly one JSON object:
{"id": "inf.schoolgirl", "output": "assets/inf.schoolgirl/reference-upscaled.png", "width": <px>, "height": <px>, "attempts": <n>, "notes": "<one sentence>"}
