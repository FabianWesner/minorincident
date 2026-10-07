# Task: draw one new concept sheet for "Suburban Survivors" (pack 19 / 21)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/decay-and-destruction.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/suburban-homes-backyards-and-street-props.png`
- `initial-drafts/emergency-services-buildings-vehicles-and-props.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "ASSET PACK 19 / 21" and "DECAY & DESTRUCTION", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
panels by world-decay tier: W1 BELONGINGS, W2 BARRICADES, W3-W4 DAMAGE, W5 RUINS

## Items (draw every one; nothing else)
- `decay.dropped-belongings`: Dropped belongings: suitcases, bag, phone, stroller
- `decay.broken-glass`: Broken glass shards pile
- `decay.boarded-windows`: Boarded-up house window and shop window
- `decay.furniture-barricade`: Furniture barricade: sofa, fridge, planks
- `decay.burned-facade.house`: Burned house facade module
- `decay.burned-facade.brick`: Burned brick shop facade module
- `decay.burned-facade.diner`: Burned diner facade module
- `decay.burned-facade.school`: Burned school facade module
- `decay.collapsed-facade`: Collapsed building facade
- `decay.rubble-pile`: Rubble piles small, medium, large
- `decay.downed-power-line`: Downed power line with sparks
- `decay.fallen-tree`: Fallen tree across a road
- `decay.crater`: Explosion crater
- `decay.body-bag`: Body bags
- `decay.abandoned-checkpoint`: Abandoned checkpoint: knocked-over tent, scattered barriers
- `decay.graffiti`: Graffiti panels: STAY OUT, ALIVE INSIDE, SG with a cross

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/decay-and-destruction.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/decay-and-destruction.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}
