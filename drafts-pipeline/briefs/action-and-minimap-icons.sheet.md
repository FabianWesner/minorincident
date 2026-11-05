# Task: draw one new concept sheet for "Suburban Survivors" (pack 21 / 21)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/action-and-minimap-icons.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/sunset-grove-combat-gameplay-mockup.png`
- `initial-drafts/weapons-consumables-and-survival-props.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "ASSET PACK 21 / 21" and "ACTION & MINIMAP ICONS", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
a grid of square action icons in the mockup's rounded dark card style, then a row of small minimap icons

## Items (draw every one; nothing else)
- `ui.icon.actions`: About 30 action icons: melee swing, heavy smash, kick, dodge roll, sprint, pistol, shotgun, SMG, rifle, machine gun, rocket, frag, molotov, pipe bomb, lure, flashbang, medkit, bandage, soda, energy drink, shield bubble, ground slam, turret, corgi fetch, corgi bark, flashlight, lockpick, radio, keys, enter vehicle
- `ui.icon.minimap`: Minimap icons: player, corgi, objective, escort, safe zone, vehicle, infected, elite, loot

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/action-and-minimap-icons.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/action-and-minimap-icons.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}
