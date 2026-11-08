# Browser QA — 2026-11-08

**In progress.** Headless native GPU checks run serially through the shared browser pool. No game code changes, deployment or push. The initial sandbox denied the pool listener and Git index; those restrictions have been removed. Restarting the idle daemon resolved its inherited Chromium Mach-port failure.

Initial main was `4640125c`; vehicle/flicker receipts use `8db1ce18`. The worktree then advanced to `ff6edd7c`, adding r12-shadow. The L8 performance merge was subsequently included at `5cd762aa`. Remaining checks are not counted as gameplay failures merely because they are pending.

## r12-l9flicker

| Check | Result | Evidence / capture |
|---|---|---|
| L9 seed 1, tick 1170, (-550,0), zoom 1.14, WebGPU/high | PASS: 30 consecutive real rendered frames, including a small camera translation. Pale track/shoulder/asphalt edges remain stable; no striped bands, floating overlay or flashing rectangle seen. The reported pixel hits the y=.0012 track at layer 6, offset −24, ahead of the shoulder. | [Receipt](flicker/l9-webgpu-high.json), [before/after sheet](../r12-l9flicker/comparison.jpg) |
| Same L9 pose, WebGL2/low | PASS: same visual findings and track priority; 30 consecutive rendered frames. | [Receipt](flicker/l9-webgl2-low.json), same sheet |
| L10 geometry fixture, tick 38160, (2363.99,-75.39), zoom 1.3, WebGPU/high | PASS for fixture: street-lamp pavement, verge, lane paint and practical-light pools remain stable over 30 consecutive frames and camera translation. | [Receipt](flicker/l10-webgpu-high.json), same sheet |
| All 18 L9 corners on both requested combinations and all five L10 corners | PASS for captured views: personally opened all corner sheets. Surface boundaries are clean; fire/light pools and decals retain normal occlusion. Some L10 authored probe sites are open grass. | 41 corner captures in same sheet; [hashed capture manifest](flicker/capture-hashes.json) |
| Actual L10 mission checkpoint at reported campus position | PENDING. Restored `cure-military` has the correct active research-campus graph, but checkpoint reconstruction places the courier at (547,0), so that capture does not prove the campus view with mission effects. | Native checkpoint cell in same sheet; receipt records exact position and state. |
| Frame pacing / rendering costs | Observed 30-frame median 16.7 ms in each combination; maxima 33.3/16.7/16.8 ms for L9 WebGPU / L9 WebGL2 / L10 WebGPU. Not an admitted quiet performance pass. No equivalent baseline draw-call measurement exists. | Per-frame and final renderer counters in receipts |
| Full one-job scene gate | PENDING | — |

I opened the original baseline sheet, all three 30-frame strips, every corner capture sheet, and the final retained before/after sheet. The original baseline contains L9 only; no L10 baseline image was present. Reviewed raw captures were deleted after hashing; one 391 KiB sheet is retained. [Capture producer](flicker-capture.ts).

## r12-vehicles

| Check | Result | Evidence / capture |
|---|---|---|
| All eight driven definitions: arrows/WASD screen headings, actual lateral travel and forward movement | PASS for runner assertions | [Receipt](vehicles/checks.json), [17-cell sheet](vehicles/review.jpg) |
| Native L1 bicycle keeps local W/S/A/D steering; native L2 boarding reaches ride | PASS | Same receipt; f10 bicycle, f11 fire-engine ride |
| Native L9 low/high, zoom 1/1.5: physical keys move the APC; native wreck/parked-car ram; awake cap | PASS for runner assertions and reviewed views. APC roof is continuous in f1/f2; native road shots and prop displacement render correctly. Low wreck moved 18.343 m; high parked pickup moved 17.498 m. One prop awake in each, budget 12. | Same receipt and sheet, f12–f17 |
| Every vehicle at close front view, visible seated driver/glazing; explicit brake/reverse; small-prop settling and fixed-structure collisions | PENDING supplementary checks. Existing sheet does not establish every requested front/glazing view or these additional contacts. | — |
| Scene gate and quiet GPU timing | PENDING | — |

The supplied `tools/qa/r12-vehicles.ts` ran with `E2E_SERIAL=1 SCENE_PORT=4341 R12_OUT=docs/reports/qa-browser/vehicles`, exit 0. Personally opened its retained sheet.

## r12-l8 opening / early APC

| Check | Result | Evidence |
|---|---|---|
| Fresh and persisted progressed L8 seed 1; low/high × zoom 1/1.5; normal mission button and physical W | PASS: gate objective/distance, world arrow, minimap pin and calm group in all eight views. First guidance ticks 0/0/3/7; physical movement 2.005–2.080 m. Personally opened the eight-view sheet and full high image. | [Manifest](l8-opening/manifest.json), [sheet](l8-opening/review.jpg) |
| High zoom 1.5, physically walk south road to APC and hold E, tick 3125 at (96.430,76.005) | PASS: sanctuary active, escape/depart pending, sanctuary checkpoint, gate marker, zero infected, no driver/passengers/entry ring. Personally opened image: group beside APC, gate arrow points back left, no gold ring or boarding prompt. | Same manifest; bottom cell in the same reviewed sheet. |
| Same door, tick 3660 | PASS for state: breach checkpoint, 24 infected, gate marker, sanctuary active, escape/depart pending, no driver/passengers/ring. Supplied runner saves only the pre-breach image; post-breach visual review remains pending supplementary route. | Same manifest |

## r12-l6 / r12-l7 physical progress

L6 low completed the mortal route with 3 deaths, 1 rescued of 29 and 28 lost. The result panel agrees. First survivor #16 remains visible at (263.065,14.270), y=4.6, but the low safe view frames the courier back on the stairs and loses the rescued body off screen. Night views show living infected inside the closed gate near the courier. These are visual FAIL candidates with exact state in [receipt](l6/receipt.json) and the personally reviewed [sheet](l6/review.jpg). The low night capture was shortened by a queued physical control command, so it does **not** certify the uninterrupted six-second caption. High reached all survivors out but did not finish within the 495-second run; later manual stair commands confound its final deaths. Fresh transition-only repeats are pending.

L7 low completed physical boarding/departure and handed over to L8: 15 boarded, 1 death, 26 rockets. No skips or assists. High reached the bus but timed out with repeated close-range rocket rejections (operator always preferred rockets). This is a QA input-policy limitation; its generated “enemy-unhittable” issues are not accepted as game damage bugs. A repeat will select the carried shotgun within six metres, matching ordinary physical controls and the native controller's range policy. High's 122 launches have a minimum interval of **50 ticks**; native Alphas show **450 maximum HP**. Three-direct-hit and low cadence evidence remain pending. The audit observed 25 mission-stat deaths (the driver's summary undercounts one). High output will be compacted after extracting its relevant event rows.

## Remaining lanes

| Lane | Required checks | Current state |
|---|---|---|
| r12-l6 | Fresh mortal low/high physical routes; successive rail cohorts; safe/last-survivor/street-clear transitions; six-second night/result at zoom 1/1.5; actor identities; scene gate | Existing physical-input playtest is running with `PLAYTEST_L6_RAIL_CAPTURES=1`. Accelerated planner-advice diagnostics stalled at the shelter after ordinary deaths and are not accepted as full route evidence. |
| r12-l7 | Low/high physical route and pickup safety; opening/corridor/bus crossfire, Alpha TTK/cadence, wounds/boarding/departure; close forward/behind/dud cases; L10 stair/charge/moving Mega; scene gate | PENDING |
| r12-l8 | Eight fresh/progressed opening cases; early APC attempt/breach; physical return to gate then APC evacuation and L9 handover, low/high × zoom 1/1.5 | PENDING |
| r12-shadow | Before/after dominant-light direction, handoff/promotion/map/luminance/hue checks, source expiry/power loss, moon/headlamps/practicals, native backend/tier/zoom matrix, scene gate and GPU budgets | PENDING; discovered in later main merge. |

## Runners and retention

[Physical playtest dev wrapper](playtest-dev.ts) uses the existing playtest driver against a private Vite dev server, with a bounded session and no separate build. [Planner-advice diagnostic](route-capture.ts) sends device events only and records deaths; it is supplementary where its policy cannot complete a real route. [L8 opening runner](l8-opening-capture.ts) is the supplied producer with report output redirected. [Shadow admission](shadow-capture.ts) and [audit](shadow-audit.ts) similarly redirect the supplied producer.

Completion still requires the pending checks, capture review, exact failures/repros, checking main's later report handoffs, pruning raw output and committing this report.
