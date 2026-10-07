# Task: draw one new concept sheet for "Suburban Survivors" (pack 20 / 21)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/gore-gibs-and-blood.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/zombies-civilian-characters.png`
- `initial-drafts/zombies-emergency-workers-and-mutants.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "ASSET PACK 20 / 21" and "GORE: GIBS & BLOOD", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
chunky low-poly gib shapes in palette reds, limb gibs with stump caps, top-down blood decals

## Items (draw every one; nothing else)
- `gib.chunk-set`: Gib chunk set: 8 chunky low-poly shapes in reds and dark reds
- `gib.limb-generic`: Generic limb gibs: arm, leg, head, each with a stump cap
- `decal.blood-pool`: Large blood pool decal, top-down
- `decal.blood-trail`: Blood drag trail decal, top-down
- `decal.arterial-spray`: Arterial spray decal, top-down

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/gore-gibs-and-blood.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/gore-gibs-and-blood.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}
