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
| All eight close front views | FAIL for APC driver visibility: opaque front armor obscures the driver/full-width pane in both front angles despite driver=1 and a seated render occupant. Roof is continuous. Other seven cabs show the seated driver through glazing; complete body panels in reviewed angles. | [Supplement receipt](vehicles/detail-receipt.json), lower cells of [combined sheet](vehicles/review.jpg), `detail-apc-front` / `military-apc` |
| Explicit brake / reverse, physical arrows | PASS: APC forward speed 11.877 → braking → −5.944 m/s under the opposite screen direction | Same receipt |
| Small props, settling / navigation, fixed structures and awake cap | PASS for chair/drum contacts: moved 7.120 / 34.899 m at contact; settled asleep with nav blockers at their new poses. Concrete barrier/fence/house stop APC at x=10.655/12.030/8.669 before their x=15 centers. Twenty-cone stress peak 8 awake ≤12. Centered cone only moved .0084 m as the hull passed over it; this probe establishes no cone shove, so no pass is claimed for that contact. | Same receipt and reviewed sheet |
| Scene gate and quiet GPU timing | PENDING | — |

The supplied `tools/qa/r12-vehicles.ts` ran with `E2E_SERIAL=1 SCENE_PORT=4341 R12_OUT=docs/reports/qa-browser/vehicles`, exit 0. Personally opened its retained sheet.

## r12-l8 opening / early APC

| Check | Result | Evidence |
|---|---|---|
| Fresh and persisted progressed L8 seed 1; low/high × zoom 1/1.5; normal mission button and physical W | PASS: gate objective/distance, world arrow, minimap pin and calm group in all eight views. First guidance ticks 0/0/3/7; physical movement 2.005–2.080 m. Personally opened the eight-view sheet and full high image. | [Manifest](l8-opening/manifest.json), [sheet](l8-opening/review.jpg) |
| High zoom 1.5, physically walk south road to APC and hold E, tick 3125 at (96.430,76.005) | PASS: sanctuary active, escape/depart pending, sanctuary checkpoint, gate marker, zero infected, no driver/passengers/entry ring. Personally opened image: group beside APC, gate arrow points back left, no gold ring or boarding prompt. | Same manifest; bottom cell in the same reviewed sheet. |
| Same door, tick 3660 | PASS for state: breach checkpoint, 24 infected, gate marker, sanctuary active, escape/depart pending, no driver/passengers/ring. Supplied runner saves only the pre-breach image; post-breach visual review remains pending supplementary route. | Same manifest |

## r12-l6

Fresh mortal physical routes, seed 1, captions enabled, WebGL2/Metal, zoom requests 1/1.5. [Low receipt](l6/low-repeat.json), [fresh high receipt](l6/high-aligned.json), [reviewed sheet](l6/review.jpg), [capture hashes](l6/repeat-capture-hashes.json). Both clean runs completed without deaths or manual intervention; one read-only map-route assist supplies ordinary physical movement bearings. The high “aligned” monitor never needed to send a command.

| Check | Low | High |
|---|---|---|
| Full route / result identities | PASS: 192.17 sim seconds, 1/29 rescued, 28 lost; survivor #16 | PASS: 189.68 sim seconds, 3/29 rescued, 26 lost; #16/#17/#27 |
| First original survivor safe / last crossed / all rescued x≥266 | PASS at ticks 11007 / 11007 / 11093 | PASS at 10931 / 10995 / 11081 |
| Gate waits for physical clearance | PASS: gateAt11230 after clearance11093 | PASS: gateAt11081, all rescued already clear |
| Full six-second night and result | PASS: world tick11530, cinematic elapsed0–359; same rescued identity remains hidden=false | PASS: world tick11381, elapsed0–359; same three rescued identities remain hidden=false |
| Recurring three-person pressure, two complete successive cohorts | INCOMPLETE: admission8142 has3 ahead at198 while courier164.74; second10542 has1 behind at228 while courier249.38 (exact40s, admission cap). No full second three-body cohort. | One three-body admission8142, photographed visibly on-track8374. No full second cohort before finish. |
| Ordinary Rejoin cue | Separate mortal high attempt visibly displays “Rejoin Marcus · 18 m” after checkpoint restoration. Physical sideways stair alignment then permits reunion/ending; no skip or teleport. | Cue cell retained in same sheet; [that run's receipt](l6/high-repeat.json). |

Personally opened every retained rail/safe/crossing/clear/night/result cell. Clean high now frames the courier and all three rescued actors in the street, with readable safe and exact “Night. Still alive.” captions. Low's survivor remains visible but its safe caption coincides with a “Survivor lost!” toast, and hostile bodies/red bars remain beside the courier in the night view; this is a readability concern for PO review, not a count mismatch. The authored cinematic camera keeps the same framing under both player-zoom requests. Two drawn=false audit samples at elapsed12 coincide with paused API zoom recapture; screenshots and hidden flags do not establish a natural-play disappearance.

A separate high run with one death rescued five, but its post-restoration all-clear captures at tick14417 are black. Those two invalid diagnostic cells are retained at the bottom of the sheet; they are not accepted as visual approval. The clean no-death high repeat above supplies usable all-clear views. The initial manually shortened low night is superseded by the full clean repeat.

## r12-l7 completed physical route matrix

[Compact receipt](l7/receipt.json), [reviewed route/departure sheet](l7/review.jpg), [capture hashes](l7/capture-hashes.json). Fresh `L7-default`, seed 1, mortal, WebGL2 Metal, 1280×800. Physical number keys, WASD and mouse; shotgun chosen below 6 m, no injected driver/god/teleport/skip. The earlier high rocket-only timeout remains an operator limitation, not a damage bug.

| Check | Low | High |
|---|---|---|
| Full route, boarding, continuous departure and L8 handover | PASS: 131.13 sim seconds, 135 wall seconds, 1 death, 15 boarded | PASS: 181.07 sim seconds, 185 wall seconds, 2 deaths, 23 boarded |
| Opening / corridor / bus physical captures, zoom 1.5 | PASS at actual ticks 224 / 3625 / 6309 | PASS at actual ticks 284 / 5753 / 9116 |
| Bus zoom 0.8 | PASS: physical approach capture | PASS: physical approach capture |
| Distinct approach pressure / follower damage | PASS: windup events from all four cardinal sectors in opening, corridor and bus; wounded #51/#58 later boarded | PASS: opening/bus all four sectors, corridor three; eight wounded followers later boarded, including #53 at 11 HP |
| Global rocket cadence | PASS: minimum 50 ticks, individual shot ticks retained | PASS: minimum 50 ticks across 31 launches |
| Native Alpha health | PASS: observed 450 maximum HP | PASS: observed 450 maximum HP |
| Alpha survives two hits, dies on third | PASS controlled production L7 spawn: 450 → 279.9 → 120.312 → 0 HP; launches67/117/167, impacts93/144/194 | PASS: same sequence and cadence |

Personally opened all 14 retained route/departure cells. Opening shows red threat telegraphs around the courier and the exit crowd; the corridor has room between the courier and following column. Bus approach shows followers near the wrecked vehicles and threats on multiple sides; the 0.8 view is closer than the 1.5 view. Both departure sequences show the bus moving along the street and leave the HUD hidden before normal L8 handover. The requested departure 0.8 zoom is overridden by its authored cinematic (actual 1.5), so only the **pre-departure bus approach** is certified at 0.8. The driver's `simSeconds=0` is a clock-reset reporting bug at L8 handover; the actual L7 mission result time is used above.

[Shared rocket safety](rocket-safety/receipt.json) and [L10 scenario fixtures](rocket-safety/L10.json) pass both qualities: 2m aim and forward living infected reject discharge; behind infected permits it; an8m shot hits. The [extended cover probe](rocket-safety/early-cover.json) tracks the projectile until its pre-5m collision, with no blast, hit or player damage. The16-tick incomplete samples are retained as superseded diagnostics in the aggregate receipt. [Alpha receipt](rocket-safety/alpha.json) disables target AI only for stationary health isolation; production spawning, damage and projectiles remain active, the courier is mortal, and no health values are overwritten. Its first-to-third impact span is1.683s; this is not moving-encounter TTK. The first native low pickup probe shows “Too close!” without another launch, then successful farther shots, but already had a prior launch; a strict first-ready repeat is queued. L10 full finale checks remain pending. Controlled safety and health cells were personally opened in the same sheet.

## r12-shadow

[Measurements](shadow/measurements.json), [personally opened 68-cell sheet](shadow/shadow-sheet.jpg). Native WebGL2/Metal and WebGPU, low/high, requested zoom 1/1.5; actual backend fallback is rejected. The latest GL/high repetition corrects the original fixture zoom labels. Fixture poses are distinct from mortal traversal evidence.

| Check | Result |
|---|---|
| Dominant brighter right street lamp, courier/corgi/infected direction | PASS all four combinations: shadows extend away from the right lamp. The before-method replay points towards the wrong side. Ground shadow hue 254.72–257.73°, inside 230–290°. |
| Rendered forty-lamp walk | PASS WebGL2 low/high: 40 changes, ≤2 promotions/s, 39 fades of 300–316.7 ms, one refreshed map, maximum pool luminance step ≤8.24% (<15%). Equivalent WebGPU long probes are queued; short rendered handoffs already cover both WebGPU qualities. |
| Power off / transient expiry | PASS all four: selected source becomes null and moon returns, with one refreshed map. Fire/work-light images show dark violet shadows extending away from their visible light pools. |
| L5 / L6 underground and outdoor / L7 / L8 / L9 / L10, both zooms | PASS for the requested fixture matrix and posed native L7-low moon probe. Outdoor practicals remain readable; the underground low-tier restriction is retained. Actual physical L6/L7 routes are separately reviewed above. |
| Moving headlight coverage | FAIL of sustained coverage in an isolated night/asphalt APC drive: source `vehicle-3-light:headL` selected around tick 21, null by tick 51 and at tick 120 on all four combinations. The beam remains visible. No stable headlight-driven actor-shadow direction is established. Repro is the `isolated-headlights` fixture in [audit](shadow-audit.ts); complete source/car/map trajectories are retained. |
| Catalog driveout headlight assertion | Not a game-defect verdict: this fixture contains a dominant street lamp, which is what the selector chose. Raw nonzero audit exits retain that assertion. The separate isolated probe above is the relevant sustained-coverage finding. |
| Geometry / map budget | PASS sampled fixture limits: maximum 82 submitted draws / 163,527 triangles; never more than one refreshed map. Quiet native GPU timing remains pending. |

The “before” restores two original Lighting methods from `a0d4f7ba^`, not a complete older build. Native L7 moon is a deliberate posed/god probe. The new production QA artifact was built on Hetzner (18.498 s, exit 0), not on the Mac; [artifact identity](production-build.json). Remote lint passes; the nullable helper type error was corrected and a remote typecheck rerun is queued.

## Remaining lanes

| Lane | Required checks | Current state |
|---|---|---|
| r12-l6 | Fresh mortal low/high physical routes; successive rail cohorts; safe/last-survivor/street-clear transitions; six-second night/result at zoom 1/1.5; actor identities; scene gate | Existing physical-input playtest is running with `PLAYTEST_L6_RAIL_CAPTURES=1`. Accelerated planner-advice diagnostics stalled at the shelter after ordinary deaths and are not accepted as full route evidence. |
| r12-l7 | See completed L7 route/safety evidence above; native pickup hint, L10 stair/charge/moving Mega and scene gate remain | IN PROGRESS |
| r12-l8 | Eight fresh/progressed opening cases; early APC attempt/breach; physical return to gate then APC evacuation and L9 handover, low/high × zoom 1/1.5 | PENDING |
| r12-shadow | Before/after dominant-light direction, handoff/promotion/map/luminance/hue checks, source expiry/power loss, moon/headlamps/practicals, native backend/tier/zoom matrix, scene gate and GPU budgets | PENDING; discovered in later main merge. |

## Runners and retention

[Physical playtest dev wrapper](playtest-dev.ts) uses the existing playtest driver against a private Vite dev server, with a bounded session and no separate build. [Planner-advice diagnostic](route-capture.ts) sends device events only and records deaths; it is supplementary where its policy cannot complete a real route. [L8 opening runner](l8-opening-capture.ts) is the supplied producer with report output redirected. [Shadow admission](shadow-capture.ts) and [audit](shadow-audit.ts) similarly redirect the supplied producer.

Completion still requires the pending checks, capture review, exact failures/repros, checking main's later report handoffs, pruning raw output and committing this report.
