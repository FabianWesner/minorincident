# Task: draw one new concept sheet for "Suburban Survivors" (pack 14 / 21)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/heavy-weapons-throwables-and-abilities.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/weapons-consumables-and-survival-props.png`
- `initial-drafts/sunset-grove-combat-gameplay-mockup.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "ASSET PACK 14 / 21" and "HEAVY WEAPONS, THROWABLES & ABILITIES", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
weapons laid out horizontally like the weapons sheet, abilities in their own panel

## Items (draw every one; nothing else)
- `wpn.knife`: Combat knife
- `wpn.fire-axe`: Red fire axe
- `wpn.katana`: Katana with wrapped grip
- `wpn.smg`: Compact SMG
- `wpn.hunting-rifle`: Wooden hunting rifle with scope
- `wpn.assault-rifle`: Assault rifle
- `wpn.machine-gun`: Light machine gun with box magazine
- `wpn.rocket-launcher`: Shoulder rocket launcher
- `proj.rocket`: Rocket projectile
- `thr.frag-grenade`: Frag grenade
- `thr.flashbang`: Flashbang
- `abl.shield-bubble`: Ability: glowing protective shield dome
- `abl.ground-slam`: Ability: ground slam shockwave ring with cracks
- `abl.turret`: Ability: deployable scrap-built tripod turret

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/heavy-weapons-throwables-and-abilities.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/heavy-weapons-throwables-and-abilities.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}
