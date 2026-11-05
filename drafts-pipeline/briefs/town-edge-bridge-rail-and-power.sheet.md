# Task: draw one new concept sheet for "Suburban Survivors" (pack 17 / 21)

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Write ONLY `initial-drafts/town-edge-bridge-rail-and-power.png` (never overwrite an existing file there).

The game already has 10 concept sheets plus a gameplay mockup in `initial-drafts/`. This new sheet must look like it
belongs to the same set: a reader flipping through all sheets should not notice it was made later.

## Style references (load with view_image BEFORE generating, then use them as references)
- `initial-drafts/emergency-services-buildings-vehicles-and-props.png`
- `initial-drafts/parks-baseball-field-and-campsite.png`
Also glance at `initial-drafts/roadside-diner-gas-station-and-street-props.png` for the sheet layout.

## Match these exactly
- Sheet layout: dark plum/navy background (#25222c), rounded dark panels with thin warm borders, small spaced-caps
  panel headers, the hand-lettered peach-orange "SUBURBAN SURVIVORS" logo with the house icon top left, a small
  spaced-caps label top right reading "ASSET PACK 17 / 21" and "TOWN EDGE: BRIDGE, RAIL & POWER", and the footer taglines
  "A QUIETER NEIGHBORHOOD TODAY" (left) and "BRAVER PEOPLE TOMORROW" (right).
- Rendering: stylized chunky low-poly 3D game assets, toy-like proportions, warm saturated colours, soft golden-hour
  lighting, clean readable silhouettes, slight bevels, same three-quarter isometric angle as the references.
  Same character proportions as the existing characters (heads about 1/4 of body height).
- Every item clearly separated from its neighbours with empty space around it (they will be cropped out one by one),
  fully visible, not overlapping panel borders. A tiny label under each item is fine.
- Landscape sheet, the highest resolution the tool offers.

## Layout
modular kit pieces in panels: BRIDGE, RIVER, RAIL CROSSING, TUNNEL, SUBSTATION

## Items (draw every one; nothing else)
- `bld.river-bridge.truss`: Steel truss bridge segment, modular
- `bld.river-bridge.ramp`: Bridge approach ramp segment
- `bld.river-bridge.gate`: Bridge barrier / lift gate
- `bld.river-bridge.charges`: Demolition charges strapped to a bridge pillar
- `kit.river-terrain.bank`: Riverbank slope piece with grass edge
- `kit.river-terrain.rocks`: River rocks cluster
- `kit.river-terrain.water`: River water surface tile
- `kit.rail-crossing.track`: Rail track segment
- `kit.rail-crossing.gate`: Crossing gate arm with red-white stripes
- `kit.rail-crossing.signal`: Crossing signal post with flashing lights
- `kit.rail-crossing.box`: Rail control box
- `bld.tunnel-portal`: Concrete tunnel portal
- `bld.power-substation.transformer`: Substation transformer
- `bld.power-substation.breaker`: Breaker panel
- `bld.power-substation.fence`: Substation chain fence with warning signs
- `bld.power-substation.lever`: Big switch lever box

Generate the sheet. If an item is missing, items overlap, or the style clearly differs from the references, generate
once more and keep the better one. Copy the chosen file from $CODEX_HOME/generated_images to `initial-drafts/town-edge-bridge-rail-and-power.png`.

Final message = exactly one JSON object:
{"file": "initial-drafts/town-edge-bridge-rail-and-power.png", "width": <px>, "height": <px>, "attempts": <n>, "missing_items": ["<asset id>", ...], "notes": "<one sentence>"}
