# Task: draw one new concept sheet for "Suburban Survivors" (pack 18 / 21)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/highway-helipad-and-safe-zone.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/emergency-services-buildings-vehicles-and-props.png`
- `initial-drafts/school-playground-and-gym.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "ASSET PACK 18 / 21" and "HIGHWAY, HELIPAD & SAFE ZONE", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
large civic center building diorama on the left, modular kit pieces on the right

## Items (draw every one; nothing else)
- `kit.highway-onramp.ramp`: Highway on-ramp segment with guard rails
- `kit.highway-onramp.sign`: Overhead green highway sign gantry
- `bld.helipad`: Helipad with H marking and landing lights
- `bld.helipad.windsock`: Windsock on a pole
- `bld.helipad.flare-stand`: Flare stand
- `bld.civic-center`: Civic center: safe-zone main building, gym-type hall, SAFE ZONE banners, sandbags at the entrance

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/highway-helipad-and-safe-zone.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/highway-helipad-and-safe-zone.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}
