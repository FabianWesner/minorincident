# Task: draw one new concept sheet for "Suburban Survivors" (pack 28 / 29)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/event-props-ammo-and-gear.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/survivors-corgi-and-equipment.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "ASSET PACK 28 / 29" and "EVENT PROPS, AMMO & GEAR", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
grid of props and pickups, one per cell

## Items (draw every one; nothing else)
- `prop.light-tower-trailer`: Mobile light tower trailer with four floodlights on a mast and generator box
- `prop.scoreboard`: Little-league scoreboard 'SUNSET GROVE' HOME/GUEST with light bulbs
- `prop.stop-here-sign-trailer`: Road message sign trailer with orange LED board reading 'STOP HERE'
- `prop.tear-gas-canister`: Tear gas canister smoking, grey with yellow band
- `pick.nail-ammo`: Pickup: box of nail-gun nail strips, orange cardboard
- `pick.pistol-ammo`: Pickup: small ammo box with pistol rounds, olive
- `pick.shotgun-ammo`: Pickup: box of red shotgun shells
- `thr.smoke-grenade`: Smoke grenade: green cylinder with pin, puff of grey smoke

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/event-props-ammo-and-gear.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/event-props-ammo-and-gear.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}


Rules: town name is always "Sunset Grove"; no real brands or logos; infected are adults or older teens only (no children).