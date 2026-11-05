# Task: cut every item out of one concept sheet

Workspace: /Users/fabianwesner/Workspace/suburban-survivors. Input: `initial-drafts/town-edge-bridge-rail-and-power.png` (pack 17).
Write ONLY `assets/regions/town-edge-bridge-rail-and-power.json` and, per item, `assets/<asset id>/reference.png` + `assets/<asset id>/description.txt`.

For each item below, find its bounding box on the sheet (look at the image with view_image; use Python + Pillow to
crop and then LOOK at each crop to verify it). A good crop contains the whole item (all views, for characters) with a
small margin and no neighbouring item. Tiny labels may be included. Save the crop at original resolution.

Items:
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

`assets/regions/town-edge-bridge-rail-and-power.json` = {"sheet": "initial-drafts/town-edge-bridge-rail-and-power.png", "regions": {"<asset id>": [x0, y0, x1, y1], ...}}.
`description.txt` = the one-line item description below.
If an item is not on the sheet, skip it and report it.

Final message = exactly one JSON object:
{"sheet": "town-edge-bridge-rail-and-power.png", "cropped": ["<asset id>", ...], "missing": ["<asset id>", ...], "notes": "<one sentence>"}
