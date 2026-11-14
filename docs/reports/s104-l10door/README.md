# s104 — L10 service doorway

The service entrance now presents a warm lamp and recessed, framed vestibule at the original emergence position. A tank-side recess clears tank A. The existing L10 see-through policy keeps this open structure whole during emergence. Render-only light registration preserves the accepted finale simulation.

[Before/after contact sheet](contact-sheet.jpg) · [Six-case cadence receipts](finale-cadence.json) · [Investigation history](investigation.json)

## Visual evidence

Opened before/after captures and the sheet: HIGH first, then LOW, zoom 1 and 1.5, headless Chromium WebGL2/ANGLE Metal and WebGPU, 1280×720. Baseline files were served temporarily from HEAD and restored automatically. Before: large dark wall face. After: visible warm lamp, frame and recessed floor; the six-second sample shows the runner inside/stepping through the vestibule. One-second sequences through 14 seconds retain the facade and roof at the formerly failing seven-second cutaway. Traces show continuous westward exit and stair ascent, with another arrival eight seconds later. The near pier briefly hides the actor in some samples; this is sampled game-camera verification, not uninterrupted visibility from all angles.

Current captures, scripts and traces: `test-results/s104/sequence-*`, `before-*-emergence-*`, `placement-recess/`, `lods/`. The report sheet contains sixteen before/after cells and is the only committed image.

Scene Lab arena placement review: no service-related triangle intersections after the recess (previously 534 with tank A). Opened shot0000: grounded and clear of platform/tank. Remaining intersections are existing pipe joins and mounted gun/deck attachment. All three authored LODs validate within existing budgets; opened preview sheet at the game lens/elevation from 45°/225°: frame, lamp, opening, footprint and vent persist. LOD2 omits fine sign/trim and simplifies roof appearance.

## Gameplay and checks

Original service placement transform, door plane, route, eight-second arrival cadence and door contract remain. No zombie/weapon statistics or corpse-removal changes. Physics asset table is unchanged. The six exact native cases complete with maximum attack gaps 14.83/17.02/15.58 seconds HIGH and 17.42/18.43/16.68 LOW; deaths 3/3/2 and 0/0/0, at or below s102 per case. The final geometry-only recess does not alter the simulation asset table or route.

- Asset build, light extraction and targeted static bakes: pass; zero light errors/unreferenced emitters.
- Final typecheck and lint: pass.
- Unchanged remote suite: exit0, 27 files, 106 passed/one skipped, manifest150/150; 216.7/240 seconds, runner46.225.66.90. Log: `test-results/s104/remote-recess-final.log`.
- Six-case cadence receipt compared programmatically with s102 `after.json`: pass.

Browser work used the lock/pool, one headless browser at a time, ten-minute reservations, E2E_PORT4941/SCENE_PORT4942. No deploy, push, main movement, forbidden-directory edit, stat tuning or corpse removal. The shared tunnel asset also gains the vestibule/recess at its existing zoo placements; its door joints, envelope and collision contract are retained.
