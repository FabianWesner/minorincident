# Task: draw one new concept sheet for "Suburban Survivors" (pack 24 / 29)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/civic-buildings-and-park.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/roadside-diner-gas-station-and-street-props.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "ASSET PACK 24 / 29" and "CIVIC BUILDINGS & PARK", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
one isolated building per panel on a small diorama base, same isometric angle

## Items (draw every one; nothing else)
- `bld.dugout`: Little-league baseball dugout: low concrete bench shelter with chain-link front and small roof
- `bld.fire-station`: Sunset Grove fire station: red-brick two-bay fire house with large garage doors, bell tower, 'SUNSET GROVE FIRE DEPT' sign
- `bld.gazebo`: White wooden park gazebo, octagonal, shingled roof, string lights
- `bld.hospital-exterior`: Sunset Grove Community Hospital exterior: three-storey white and teal building, emergency entrance canopy, red cross sign
- `bld.power-substation`: Small electrical power substation: fenced yard with transformers, insulators, warning signs
- `bld.restroom-block`: Park restroom block: small concrete building, men/women doors, flat roof
- `bld.safe-house`: Barricaded suburban safe house: one-storey house with boarded windows, sandbags, plank barricades, 'SURVIVORS INSIDE' painted
- `bld.shed`: Wooden garden shed with tool rack, small window, slanted roof

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/civic-buildings-and-park.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/civic-buildings-and-park.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}


Rules: town name is always "Sunset Grove"; no real brands or logos; infected are adults or older teens only (no children).