# Task: draw one new concept sheet for "Suburban Survivors" (pack 29 / 29)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/more-vehicles.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/roadside-diner-gas-station-and-street-props.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "ASSET PACK 29 / 29" and "MORE VEHICLES", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
vehicle turnarounds: large three-quarter front-right view plus small side view per vehicle; no real brands

## Items (draw every one; nothing else)
- `veh.fuel-truck`: Fuel tanker truck: white cab, silver tank trailer with hazard placards, no brands
- `veh.jeep-red`: Red open-top off-road jeep with roll bar and spare wheel
- `veh.pickup-white`: White pickup truck, single cab, slightly dented
- `veh.police-suv`: Sunset Grove police SUV: black and white, light bar, push bar, 'POLICE' text
- `veh.sedan-green`: Green four-door sedan, family car
- `veh.suv-green`: Green mid-size SUV with roof rails
- `veh.train-freight`: Freight train: diesel locomotive plus one boxcar (no real railroad marks)

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/more-vehicles.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/more-vehicles.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}


Rules: town name is always "Sunset Grove"; no real brands or logos; infected are adults or older teens only (no children).