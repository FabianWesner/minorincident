# look-l9b — L9 night drive, second look pass (Fable 5.1, 2026-10-20)

Start: lane/look-l9 tip (394e2c42e, score ~5-6). PO findings addressed: (1) washed-out pale lilac ground, (2) pale flat
octagon discs, (3) oversized self-lit lane stripes, (4) tiny fires / flat grey smoke, (5) washed-out crash approach.
Kept: headlight cones with dust, moon shadows, red mast blinker.

## What changed
- `src/data/timeOfDay.ts` L9-crossing: moon .38 (#c6d3f2), shadow #141a2c, sky #0d1727, deep-blue grade shadow, contrast 1.34,
  breakup .22 (highlights capped in `PaletteMaterial.ts`), city glow .25 #ff3a10, roadLift 2.0 with a silver #aebfd3 (the route band
  on dark verges: E31-AC16).
- `layouts/D-CROSSING/layout.py` + `dress.py`: road marks and edge lines in grey paint tokens (silver / pantsLight), dry pan
  leatherEdge, dry-shortcut strip trouser, ruts leatherShadow, gully banks trouser/leatherEdge, wheat khaki/capTan, dust pans and
  scrub mats leather (28 % smaller pans), road patches pantsCargo, road dust khakiSeam, tufts without mustard. Blob rims wobble
  from a separate RNG (`RB`); clearance tests use the plain outline, so every placement, collider and walkable is byte-identical
  to look-l9 (verified against HEAD's layout.json after each rebuild). Layout rebuilt (Blender) + chunks/horizon (9915 tris).
- `src/render/NightAccents.ts` / `vfx/Blasts.ts`: brush fires 1.1-1.8 m, farm 1.3-2.1 m, city 2.4-3.8 m; flame tongues and
  smoke columns scale with the radius (gameplay fires unchanged).
- Catalog: `l9-look-crash-approach` (AC16 contrast gates) and `l9-look-city-edge` (budgets), in `scene:matrix`.
- Tools: `tools/qa/l9-look-gen.py` (city-edge fixed view), `tools/qa/l9b-capture.sh`.

## Rounds 5-7 (final)
- Round 5 (`28cefec0d`): gully banks in the dark pan tokens; roadLift 2.0 lifted the crawl read to 4.7-5.0 but made the asphalt
  a pale day-grey band, so round 7 settles on **roadLift 1.4 #aebfd3**: apc 3.5-3.9, road 3.5-4.0, crawl 3.6-4.1 (gate 2.5,
  floor 2.0, untouched) at high and low.
- Round 6 (`573eefd4d`): the flat ground discs/slabs are gone (`dress.py` `FLAT_DISCS = False`: dust pans, scrub mats, pasture
  patches, road patches, road dust, verge tufts, dry-zone field bases; callers keep every R draw, placements unchanged).
- Round 7: city-edge view 2 m before the town-hall front (556, -21); `l9-look-crash-approach` gates budgets/headlights/console
  (the contrast sampler finds no pairs on the last 40 m before the barricades; AC16 for that asphalt is `night-read-l9-apc`).
  `tools/qa/l9b-before-after.py` builds the before/after sheet from the look-l9 cells.

## Sheets (WebGPU unless noted; rows = stretches, columns = tier x zoom)
- `before-after.jpg` (FINAL, round 7): look-l9 cells (WebGPU high z1, from docs/reports/look-l9) next to high/low z1/z1.5 and
  WebGL2 high z1. The city-edge "before" cell is look-l9's old viewpoint.
- `before-after-round4.jpg`: the same layout for round 4 (fork after-high cells empty, see below).
- `round1-webgpu.jpg` .. `round3-webgpu.jpg`: iterations (dark preset -> dark dry tokens -> dark ruts/track).
- `round4-webgpu-high-low-z05-1-15.jpg`: round 4 at zoom 0.5 / 1 / 1.5, high and low. Fork high z1/z1.5 cells are empty
  (Scene Lab "execution context destroyed" on those two runs; the low cells and round 3 show the fork).
- `round4-webgl2-vs-webgpu-z1.jpg`: WebGL2 high vs WebGPU high/low at zoom 1 (fork, dry shortcut, crash approach): identical read.
- Before: `docs/reports/look-l9/sheet-*.jpg` (same stretches at zoom 1).

## What I see (round 4) and honest score
- Route start / fork / road diagonal: dark blue night, silver road band, moon shadows of poles and fences, headlight cone and
  motes, a brush fire at the top right at z1.5. 7/10.
- Dry shortcut: dark pan, the track as a brown band with dark ruts, red flare pools, the mast blinker; one scrub mat still
  reads as a pale disc (fixed in round 5 tokens, not captured). 6.5/10.
- Crash approach: dark, the headlight pool and the red barricade lamps carry the frame, the city glow warms the east faces
  without washing the asphalt. 6.5-7/10.
- Countryside: orange dirt track under the headlights, green pasture, farm/brush fires at z1.5. 6.5/10.
- City edge (fixed camera 560,40): bigger fires with dark smoke columns lit from below; the viewpoint itself is a flat facade
  and not a good hero shot. 6/10.
Overall ~6.5-7: night now reads as moonlit night with warm pools; what is missing for a clear 7+: the headlight pool bleaches
to near-white at zoom 1 (kept per PO), the fires are still small at zoom 1 on the open stretches, no sky/horizon in frame.

## Gates
- Unit (remote, full): 294/296 passed before the night-read fix; after it the night-read/L9 files pass locally (58/58).
- tests/levels L9/L10 + tests/sim (remote): 153 passed, 3 timing p95 tests failed on a loaded runner and passed on re-run (3/3).
- Scene Lab round 4 (catalog-high/low, roadLift 1.0): apc nav median 2.4-2.9 (gate 2.5 ok), road 2.3-3.0 ok, player 15.6;
  crawl FAILED (1.2-1.5: the asphalt band was only .045 luminance against the kit rubble at .034). Round 5 raises the lift to
  2.0 and darkened the gully banks (crawl 4.7-5.0); final roadLift 1.4: apc 3.5-3.9, road 3.5-4.0, crawl 3.6-4.1, both tiers,
  all five catalog scenes pass (route luminance ~.07 against a verge of .005).
- Final sheet captures (round 7, 38 + 5 scenes): all passed budgets (draws <= 300, tris <= 500k), no console errors, clipping 0.
- E18: every look scene passed drawCallsMax 300 / trianglesMax 500k (low) on both tiers; no console errors; clipping 0.
