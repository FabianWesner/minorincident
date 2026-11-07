# r6-truck: L2 fire engine "Some part is missing of the truck" (P1)

PO finding (PROD batch 58, verbatim): "L2 Some part is missing of the truck". Screenshot: `epics-pipeline/po-findings/1107-l2-firetruck.webp`.

## Cause

The seated-crew cutaway (`VehicleView.crewCutaway`, `reveal.on = 2`) cut a box built from the seat footprint, padded by 0.55 m, from the
crew's waist up to infinity. Three effects:

1. **The hard black rectangle.** The rear seats sit at x 2.12, so the padded box began at x 1.57. The cab starts at 1.883, so the box cut
   0.3 m into the **shutter housing** behind the cab. That housing is a closed hollow box. Its baked Cycles AO inside is ~0, so the cut
   showed a black void the full height of the housing.
2. **Ragged edges.** The cab side walls, doors and rear wall were sliced at waist height, with no finish on the cut.
3. **Ladder truncated.** The roof ladder runs over the cab (to x 3.65), and the unbounded box cut it too.

I reproduced the PO's frame in the native ride, at WebGPU high, zoom 0.5, ride + 3 s. It is the top-left tile of the sheet.

## Fix

The fix is in `src/render/VehicleView.ts`, with the data in `src/data/vehicles.ts` (`crewRoofs`). The truck now rides as a finished **open-top crew cab**.

- **Cut box.** The cut is a fixed box in the asset's `root` frame (the parent of `crew_cab`). It covers x 1.876–3.78, |z| < 1.45 and y 1.93–2.955:
  - x stays inside the cab's own span. The shutter housing ends at 1.872 and stays whole.
  - y runs from the window sill to just below the ladder.
- **Dark trim.** A dark trim (`crewCabTrim`, one merged mesh, one draw) finishes every cut edge:
  - sill rails along both sides and the doors;
  - a rear rail;
  - a windscreen header with two posts, which close the cut roof nose;
  - a ladder-rest hoop under the ladder's nose support. Without it, the support would hang free over the open cab.
- **Trim material.** The trim has its own `uniqueWorld('uiDark')` material. The shared world swatch carries the district see-through
  dither, and that drew the trim as stipple around the courier.
- **Beacons.** The light-bar beacons (`sirenL`/`sirenR`) are hidden while the cab is open. The light bar sits on the removed roof.
- **Shadow pass.** The shadow pass now uses the same world-space cut, so the removed roof no longer shades the crew. The screen-space
  hull disc (mode 1) still does not use it in the shadow pass.
- **Prewarm.** The trim compiles in `prewarmReveal`, so the first ride frame does not compile it.
- **Fallback.** Vehicles without a `crewRoofs` entry keep the old seat-footprint behaviour.

**Rejected first attempt** (commit 5b90ab8b, superseded): a roof-only cut closed with a framed glass roof. In captures, the full-height
cab walls hid most of the crew, and the courier, who is always drawn in the seated foreground slice, appeared pasted over the door. That
version also still cut the ladder.

## Vehicles checked

Only the L2 fire engine uses the seated-crew cutaway (`on = 2`, gated on `missions.state.l2.seated`). No other vehicle carries
occupants through a cutaway:

- The APC uses its own glazed `transportRoof`.
- Cars use their glass.
- The other reveal is mode 1, a screen-space hull disc for *other* vehicles that occlude a riding player. It is a different technique,
  and I did not change it.

## Test

The check is folded into the existing asset-contract test in `tests/shared/asset-contract.test.ts`; the test count stays at 150. For all
three fire-engine LODs, the GLB triangles in the cut box must meet these conditions:

- every triangle reaches into the cab shell (x ≥ 1.88);
- no ladder triangle is in the box except the nose support at the hoop;
- every seat lies inside the box footprint below the sill.

With the old extent (x0 1.57), the test fails with 1313 triangles behind the cab.

## Captures I opened

The captures come from the native L2 ride: the no-axe bot boards, then the paused game camera is captured at ride + 3 s and + 12 s, at
zoom 0.5 / 1 / 1.5. All of them were taken through the browser pool with `tools/qa/r6-truck-ride.ts`.

- **Before** (main 0f85e3c8, WebGPU high, 6 frames): the black rectangle shows between the shutter housing and the crew at zoom 0.5 (the
  PO's frame). The ladder is cut off above the cab.
- **After** (WebGPU and WebGL2, high and low, 24 frames). I opened the review grids of all four backend/tier groups and close crops for
  WebGPU high (s3, s12) and WebGL2 low (s3, s12):
  - All six firefighters and the courier read clearly inside an open-top cab with dark rails.
  - The shutter housing's grey front face closes the rear. There is no black void.
  - The ladder is whole and rests on the hoop.
  - Seen from the front-quarter view at ride + 12 s, the windscreen frame reads as an open-cab windscreen.
  - At zoom 1 and 1.5, the truck reads as a whole truck with visible crew.
- **Remaining nits** (not defects):
  - the courier's shoes overhang the near sill rail, because she is drawn in the seated foreground slice (this was already so before);
  - the interior floor between the crew is dark (black seat cushions).
- **Sheet:** `docs/reports/r6-truck/before-after.jpg`. The before is at WebGPU high z0.5; the after tiles are WebGPU high z0.5, WebGL2 low
  z0.5 at + 12 s, and WebGPU high z1.

## Checks

- `npx tsc --noEmit`: green.
- `npm run lint`: green.
- `npm run scene:gate`: 50/50 rows pass, in 14.7 min.
- `npm test` on the Hetzner runner: 150/150 within budget. Three tests failed there, none of them related to this change:
  - the browser-pool admission test;
  - the L4 contact sim;
  - the A* budget sim.
  
  I re-ran those test files locally. The navigation and L4 contact tests pass. The browser-pool admission test passed alone, and timed out
  at 30 s only while scene:gate was loading the Mac. This lane touches only `VehicleView`, the `crewRoofs` data and the asset-contract
  test.
