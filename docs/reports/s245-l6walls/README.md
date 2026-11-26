# s245 · L6 tunnel side walls

## Change

`tools/l6/build-layout.ts` now emits full-height collision strips along the two drawn tunnel wall faces. Each strip is 3.75 m tall (`y=.35..4.1`) and sits outside the measured inner faces at south `z=11.2` and north `z=18.8`. Five 4.6 m apertures remain at the placed maintenance corridors. The hatch markers at x=162 and x=228 spawn arrivals inside the tunnel. The generated `D-SUBWAY.layout.json` is produced by the layout tool.

`Companion.respawnNear` now accepts a solid-clear candidate only when `nav.visible` also connects it directly to the courier. Its existing near-point searches and admission fallback remain.

## Reachability evidence

`l6-wall-reach.ts` flood-fills the L6 **player nav grid** from the tunnel and reports mission anchors, service doors, off-footprint cells and sampled physical wall clearance. The map images show blocked cells in charcoal, reached in-footprint cells in pale gray, and any reached out-of-footprint cell in red.

| Measure | Before | After |
| --- | ---: | ---: |
| Reached cells | 20,731 | 20,488 |
| Reached cells outside authored footprint | 0 | 0 |
| South physical wall samples blocked | 94 / 180 | 186 / 186 |
| North physical wall samples blocked | 130 / 180 | 186 / 186 |
| Mission anchors and all 8 L6 door approaches reached | yes | yes |

The before image uses the committed layout; the after image uses the regenerated layout. The player-grid mask already bounded the authored playable footprint before this change. The physical collision samples show the change: both drawn wall faces are solid at every sampled point, while the door approaches remain in the same reached component.

[Evidence sheet](evidence.jpg): before and after flood maps, followed by HIGH and LOW scene captures.

At the reported respawn position `(110.18, 15.62)`, the diagnostic places the corgi at `(110.18, 17.62, 1.17)`: nav-clear and visible from the courier, inside the drawn tunnel band.

## Balance and validation

Threat audit before and after both report **zero L6-specific flags**. Each invocation also emits the expected `PARTIAL_LEVEL_SELECTION` marker because only L6 was selected.

- Baseline: `node --import tsx/esm tools/qa/threat-audit.ts --levels L6` — 0 L6 flags; 1 partial-selection marker.
- After: same command — 0 L6 flags; 1 partial-selection marker.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `tests/engine/npcs.test.ts` corgi regression: pass.
- E24 verifier via `node --import tsx/esm tools/verify.ts E24`: pass. The `npm run verify` tsx launcher cannot create its IPC pipe under this sandbox.
- Full unit suite in the verifier: pass, 27/27 files and 107/107 executed tests, 136.9 s of the 240 s budget. The test-budget scan covered 150 cases across 45 files.
- Remote unit request on the final commit: runner available, but the 240 s budget expired at 245.6 s (exit 124); the suite did not finish. Completed files, including the corgi test, passed. The local suite above passed.

## Visual review

HIGH and LOW Scene Lab runs passed at game-camera zoom 1.5 with zero console errors and undrawn frames. The [evidence sheet](evidence.jpg) shows the courier on the illuminated side walkway at the drawn wall and the survivor group on the track. Both tiers preserve the visible tunnel geometry. The capture does not independently prove all movement contacts; the physical collision sampling above supplies the wall coverage evidence. Individual frames and metrics are in `test-results/s245-high/` and `test-results/s245-low/`.

## Follow-up: corridor mouth

The prior flood measured the tunnel-side approach to each door, not a traversal across the doorway. A physical clearance sweep found the placed north maintenance corridor at x=174 had been sealed by the new wall. The layout now leaves a 4.6 m aperture there. A regression samples an actor-radius path at x=172.25 from z=17.5 to 19.9; it passes. The L6 threat audit after this correction again has zero L6 flags and only `PARTIAL_LEVEL_SELECTION`. Typecheck, lint and the focused corgi test pass.

A sweep at 0.25 m horizontal and 0.1 m depth intervals found clear crossing samples at the five placed maintenance corridors (54, 78, 126, 174 and 198). The authored hatch at x=228 has no clear crossing sample in its 4 m mouth, and the x=162 and x=228 hatches have no corresponding placed maintenance corridor in the current layout. The level spawns hatch arrivals on the tunnel side; whether these should be physical passages and how they should be represented visually remains unproven. The hatch arrivals are spawned inside the tunnel; subsequent investigation closed the wall gaps at x=162 and x=228, where there are no placed corridors. Their tunnel-side approaches remain reachable and the L6 threat audit still reports zero level flags. The old 180-point samples excluded different apertures; the current 186-point sampling excludes all five placed corridor mouths. The images show the updated player-grid flood and final HIGH and LOW scene captures.

The generated collider interval audit covers x=30–246 on both sides except the five placed corridor intervals, at y=.35–4.1. The crowd admission fallback and a full movement traversal remain unverified.

## Deferred respawn admission

The fallback admission and its retries now require nav visibility from the current courier position before placing the companion. A focused regression forces all visibility checks to fail, confirms the dog stays hidden and pending through retries, then restores visibility and confirms a reachable admission. The focused test, typecheck, lint and local E24 verifier passed (107 tests, 141.2 s). L6 threat audit remains at zero L6 flags, with the partial-selection marker. The remote full suite again exceeded its 240 s budget (245.6 s, exit 124); its corgi and L6 mission test files passed before timeout.

## Movement sweep

`node --import tsx/esm tools/qa/diag/l6-wall-reach.ts /private/tmp/s245-sweep.png` uses the shared static actor sweep from the track toward each side at 0.5 m x intervals, omitting the placed corridor openings and ignoring other actors. All 402 south and 412 north samples stopped before crossing the outer face; no leaks were recorded. This samples actual movement collision, while the continuous collider intervals establish coverage between samples. The sweep can also stop at other static geometry and therefore does not independently establish that each stop was the added wall. Typecheck and lint passed after adding the diagnostic.

A further remote full-suite attempt on the committed fix ran the corgi and mission files successfully but again hit the 240 s limit (242.0 s, exit 124). The previously recorded local full-suite pass remains the complete unit result.

Remote retry with the same full inventory and 240 s budget, explicitly using the permitted four Vitest workers, timed out at 240.7 s (exit 124). The corgi, L6 mission and vehicle files passed before timeout. The runner was sharing CPU with another job; this is not a full remote pass.

A whole-run isolated remote retry reserved both runner slots and ran the unmodified `npm run test:unit`; it still timed out at 245.4 s (exit 124), after the corgi and long L4 contact files passed. This confirms the current remote host did not complete the gate within 240 s even without another scheduled runner job.
