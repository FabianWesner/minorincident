# Task: draw one new concept sheet for "Suburban Survivors" (pack 13 / 21)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/survivor-gear-tiers-and-action-poses.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/survivors-corgi-and-equipment.png`
- `initial-drafts/sunset-grove-combat-gameplay-mockup.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "ASSET PACK 13 / 21" and "SURVIVOR GEAR TIERS & ACTION POSES", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
top half: male and female survivor front views at gear tiers 1-4 in two rows; bottom half: action poses

## Items (draw every one; nothing else)
- `char.survivor-male.gear-t1`: Male survivor tier 1: backpack with duct tape
- `char.survivor-male.gear-t2`: Male survivor tier 2: knee and elbow pads, thigh holster
- `char.survivor-male.gear-t3`: Male survivor tier 3: padded vest, cap
- `char.survivor-male.gear-t4`: Male survivor tier 4: heavy vest, ammo belts, gas mask
- `char.survivor-female.gear-t1`: Female survivor tier 1: backpack with duct tape
- `char.survivor-female.gear-t2`: Female survivor tier 2: knee and elbow pads, thigh holster
- `char.survivor-female.gear-t3`: Female survivor tier 3: padded vest, cap
- `char.survivor-female.gear-t4`: Female survivor tier 4: heavy vest, ammo belts, gas mask
- `char.survivor.pose-kick`: Pose: front kick
- `char.survivor.pose-throw`: Pose: grenade throw arc
- `char.survivor.pose-rifle`: Pose: two-hand rifle aim
- `char.survivor.pose-heavy`: Pose: carrying a heavy weapon (machine gun)
- `char.survivor.pose-driving`: Pose: seated driving

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/survivor-gear-tiers-and-action-poses.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/survivor-gear-tiers-and-action-poses.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}
