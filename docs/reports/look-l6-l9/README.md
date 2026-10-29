# look-l6-l9 (Opus, 2026-10-29)

QA batch 27, verbatim: "L6, L9 and L10 read well but are dark and sparse". Base: main `1eb327524`.

## Change
- `src/levels/decor.ts`: render-only `decor` placements from existing kit (dropped belongings, trash bags, crates, pallets,
  bedrolls, chairs, coolers, carts, cones), deterministic, joined to the layout in `DistrictWorld` (Scene Lab adds its own crop).
  `placementColliders` and the pushable filter skip `decor`, so nav hash, colliders and pushable ids are identical with and
  without it (unit guard in `tests/engine/world-systems.test.ts`). No layout JSON, GLB or Blender rebuild.
  - L6 tunnel: pieces along the wall half of both walkways (mostly the north one, which the game camera sees past the track),
    bags/pallets at the track-bed edge, six abandoned camps (bedroll, luggage, chair, cooler). Night street: luggage, bags,
    cart, cones, crates along the walk to the exit.
  - L9: an "exodus spill" every ~20 m on every route (4-7 pieces over one shoulder and its lane edge; lane-edge pieces only
    low/flat and within 1.4 m of the edge), and a roadside camp every fourth spill. Nothing past x 500 (crash/crawl).
- `src/render/NightAccents.ts` `subwayAccents`: red retreat flares on the track bed edge (~every 12 m, not at gates), a storm
  lantern at each tunnel camp, the fuel-truck crater and a small debris fire by the wreck burn on the night street.
- Tools: `tools/qa/look-l6-l9-gen.py` (L6 game-camera route specs; L9 uses `l9-look-gen.py`), `look-l6-l9-sheet.py`, `look-l6-l9-metrics.py`.

## Evidence
- `before-after-l6.jpg`, `before-after-l9.jpg`: per region, before/after x high/low x zoom 1/1.5, WebGPU.
- `after-webgl2-high-z1.jpg`: L6 tunnel-east and L9 countryside on WebGL2 (same read as WebGPU).
- Budgets per capture: +3..9 draws, +2..15k triangles (max 71 draws, 163k tris high); clipping 0 on every L9 capture.
- Night read (catalog, WebGL2 high): night-read-l9-apc 3.3, crawl 2.8, road 2.8 (gate 2.5).

## Honest look score
- L6 before ~5, after ~5.5: the north walkway now carries abandoned belongings and lantern-lit camps, flares mark the
  retreat line, the exit street has fire light and luggage. The near walkway stays hidden behind the wall piers; the tunnel
  is still mostly dark track and the street a flat purple slab.
- L9 before ~5.5, after ~6: most frames now show a spill of luggage/carts/chairs on the shoulder, so the road reads as an
  evacuation route; at zoom 1 the 12 m road still fills most of the frame, and the pieces are small next to the APC.
- Not "stunning >= 7". What would move it: road-edge wrecks/checkpoints with real colliders (sim change, so out of scope
  here), a narrower L9 carriageway like L10, wet-road reflections (no shader support today), and wall-mounted lit
  signage/flicker in the L6 tunnel.
