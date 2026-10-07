# Task: draw one new concept sheet for "Suburban Survivors" (Level 1 key locations)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/l1v2-key-locations.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/sunset-grove-combat-gameplay-mockup.png`
- `initial-drafts/weapons-consumables-and-survival-props.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "LEVEL 1" and "KEY LOCATIONS", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
two rows of larger panels for the buildings (each building shown at the game's three-quarter isometric angle, front facing camera, with a little sidewalk/yard context), then a row of smaller panels for the vehicle and props, then a row with the courier characters (front and back view)

## Items (draw every one; nothing else)
- `bld.clinic-annex`: the suspicious delivery destination — a small, clean, slightly too modern one-storey medical/lab annex tucked into the suburban street ("Sunset Grove Medical Annex", no real brands): frosted windows, a keypad door with a small canopy, rooftop HVAC and an exhaust stack, a biohazard sticker and a delivery hatch, cold blue-white interior light leaking out, a lone security camera, a few warning signs, an air of "something is off" while still fitting the friendly neighborhood.
- `bld.garage-detached`: a detached suburban garage with the roller door half open; inside visible: a workbench, pegboard with tools, a baseball bat leaning against the bench (the first weapon), boxes, a bicycle hook, a lawn mower; warm cluttered and lived-in.
- `bld.cafe-corner`: the start-area café on a street corner ("Sunset Grove Coffee", no real brands): striped awning, outdoor tables with umbrellas, a chalkboard sign, big warm windows, potted plants, a bike rack; friendly morning hub.
- `veh.courier-bike`: a courier's cargo bicycle with a front delivery box (orange/teal courier colours), chunky toy-like proportions, kickstand down.
- `prop.package-courier`: the courier parcel — a sealed medical-looking cardboard box with cold-chain stickers and a small blue light, plus a handheld scanner.
- `char.courier-outfit`: the player as a young courier, a female and a male variant (same chibi proportions as the existing survivors: big head, chunky hands and shoes): courier cap, short-sleeve polo in courier orange/teal, messenger bag across the body, shorts or cargo pants, sneakers; friendly, energetic; front and back view for each.

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/l1v2-key-locations.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/l1v2-key-locations.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}
