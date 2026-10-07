# Task: draw one new concept sheet for "Suburban Survivors" (pack 27 / 29)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/street-and-camp-props.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/roadside-diner-gas-station-and-street-props.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "ASSET PACK 27 / 29" and "STREET & CAMP PROPS", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
grid of props, one per cell

## Items (draw every one; nothing else)
- `prop.dumpster`: Green metal dumpster with lids, wheels, graffiti-free
- `prop.fire-extinguisher`: Red fire extinguisher with black hose
- `prop.folding-chair`: Metal folding chair, grey
- `prop.pallet`: Wooden shipping pallet
- `prop.plank-stack`: Stack of wooden planks tied with rope (barricade material)
- `prop.sandbag-pallet`: Pallet stacked with sandbags
- `prop.shopping-cart`: Metal shopping cart with red handle
- `prop.sofa`: Old brown three-seat sofa, worn cushions
- `prop.vending-cart`: Street hot-dog vending cart with umbrella (no brand)

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/street-and-camp-props.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/street-and-camp-props.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}


Rules: town name is always "Sunset Grove"; no real brands or logos; infected are adults or older teens only (no children).