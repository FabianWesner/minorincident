# Task: draw one new concept sheet for "Suburban Survivors" (pack 16 / 21)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/wrecked-and-burned-vehicles.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/suburban-homes-backyards-and-street-props.png`
- `initial-drafts/emergency-services-buildings-vehicles-and-props.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "ASSET PACK 16 / 21" and "WRECKED & BURNED VEHICLES", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
two rows: WRECKED (dented, broken glass, flat tyre, door open) and BURNED (charred black, rust, no glass, no tyres)

## Items (draw every one; nothing else)
- `veh.sedan-red.wrecked`: Red sedan, wrecked
- `veh.sedan-blue.wrecked`: Blue sedan, wrecked
- `veh.sedan-white.wrecked`: White sedan, wrecked
- `veh.suv-dark.wrecked`: Dark SUV, wrecked
- `veh.pickup-red.wrecked`: Red pickup, wrecked
- `veh.police-sedan.wrecked`: Police sedan, wrecked
- `veh.ambulance.wrecked`: Ambulance, wrecked
- `veh.school-bus.wrecked`: School bus, wrecked
- `veh.sedan-red.burned`: Red sedan, burned
- `veh.sedan-blue.burned`: Blue sedan, burned
- `veh.sedan-white.burned`: White sedan, burned
- `veh.suv-dark.burned`: Dark SUV, burned
- `veh.pickup-red.burned`: Red pickup, burned
- `veh.police-sedan.burned`: Police sedan, burned
- `veh.ambulance.burned`: Ambulance, burned
- `veh.school-bus.burned`: School bus, burned

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/wrecked-and-burned-vehicles.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/wrecked-and-burned-vehicles.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}
