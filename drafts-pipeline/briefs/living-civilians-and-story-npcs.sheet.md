# Task: draw one new concept sheet for "Suburban Survivors" (pack 11 / 21)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/living-civilians-and-story-npcs.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/zombies-civilian-characters.png`
- `initial-drafts/survivors-corgi-and-equipment.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "ASSET PACK 11 / 21" and "LIVING CIVILIANS & STORY NPCS", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
character turnarounds (front, three-quarter, back) per character, like the infected sheet

## Items (draw every one; nothing else)
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

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/living-civilians-and-story-npcs.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/living-civilians-and-story-npcs.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}
