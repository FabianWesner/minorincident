# s140-wreckground — native audit in progress

## Outside-wire standstill

Ran the full registered L4 mission on the native simulation (seed 1, HIGH, complete bot): 18,468 ticks through mission progression. Every tick, the observer considered living, visible, non-emerging infected outside the perimeter and within 2 m of the authored perimeter walls. It counted a tick only when the infected `NavGrid` had a path from that actor to the courier. The scan recorded 29 actor intervals lasting at least five seconds; none accumulated less than 1 m of travel during its interval. This aggregate does not exclude a stationary five-second subwindow inside a longer moving interval. Closure requires a rolling-window scan with actor target and attack state. IDs, archetypes, interval ticks, duration, travel and closest wire distance are in `qa.json`.

The existing `checkOutsideWireRouting` regression also passes. It covers one actor following the perimeter to an opened north breach for 600 ticks. The full-run scan extends that evidence to real actors and path validity without changing AI stats or corpse handling.

## Wreck grounding

The source-layout inventory is 414 vehicle wrecks. The renderer-shared resolved `district.decay.placements` inventory contains 409 at-load placements: L1 0, L2 0, L3 23, L4 0, L5 25, L6 1, L7 38, L8 0, L9 84, L10 238. Five L8 candidates are filtered before rendering. This turn did not measure contact gaps against resolved terrain heights and did not perform the requested full-level backend close-ups. `isolated-wreck-reference.jpg` is only the previously reviewed isolated HIGH WebGPU comparison; it is not campaign grounding evidence.

## Remaining work

- Measure the lowest wheel/body contacts against terrain and raised-road support for the renderer-resolved placements, including L9 and streamed L10. Then list offenders and fix placement data if needed.
- Render and review HIGH WebGPU and WebGL2 full-level close-ups at zoom 1.5 for the worst ten and five random in-range wrecks, with identity-checked rendered matrices.
- Add any discovered ground-gap condition to the existing placement gate and extend existing tests only.

## Measurement follow-up

`DistrictBuild.restOnGround` changes rendered vehicle Y using the median of four support samples when authored Y is at most 1 cm. A native contact scan must reproduce this renderer adjustment as well as asset mesh transforms; raw resolved placement coordinates are insufficient. The L4 preliminary scan also needs rolling five-second windows before standstill can be ruled out.

## Rolling-window reproduction

The repeated native seed-1 HIGH complete run finished at tick 18,468 and evaluated 15,405 eligible rolling windows longer than five seconds. Three identities travelled less than 10 cm during a window: Alpha #296 (ticks 3005–3306, zero movement), Alpha #372 (7584–7885, 9.87 cm), and crawler #233 (15676–15977, 9.69 cm). All three retained a scripted destination and targetId 0 despite the independently checked route to the courier. This contradicts a broad no-standstill conclusion from the aggregate scan. Navigation/script ownership still needs diagnosis and correction; no fix is claimed. Exact states and positions are in `qa.json.outsideWireRollingScan`.

## Script ownership diagnosis

`InfectedSystem.followScript` suppresses ordinary targeting while a scripted destination remains set and stops seeking within 0.6 m of it. `LevelFourWar.funnel` excludes Alphas from its open-breach routing loop. `L4Collapse` also deliberately assigns stationary scripted holds before battle beats. These sources explain why targetId 0 alone cannot establish a navigation defect. Next capture must match each flagged identity to its director Alpha job, breachApproach and pressure target before changing ownership. The exact rolling-scan source is preserved in `qa.json.rollingScanReproduction` using repository-relative imports.

## Identity ownership capture

Repeated full-run scan reproduces the same three stationary identities. Crawler #233 retains `breachApproach: outside` in collapse at ticks 15676–15977, with a scripted destination only about 10 cm away and an expired pressure target (until tick 3769). This matches the script follower arrival dead zone and needs a focused regression. Alpha job identities are west (#296) and line (#372), but job and breach objects in this capture were retained by reference, so their later stage/open times cannot establish state at the flag. A subsequent capture must clone these objects at observation time. Evidence remains preliminary.

## Collapse breach navigation correction

Confirmed lifecycle defect: `funnel()` ran only during war, leaving slow exterior approach arrivals in collapse at completed scripted waypoints. Continue the existing funnel updates in collapse. Extended `checkOutsideWireRouting` with a crawler arriving at its exterior waypoint during collapse; it must advance the approach within 30 ticks. Focused L4 contact test, typecheck and lint pass. Full native after-scan, Alpha diagnosis and prescribed remote suite remain pending.

## Full-run validation of collapse correction

After d7b89cf8, seed-1 HIGH complete mission again reaches progression. The scan evaluates 16,827 rolling windows and no longer flags crawler #233. Alpha #296 and #372 still flag. Controller state is now cloned at observation: #296 is west/charge at an open west breach; #372 is south/walk as its breach opens. Their navigation remains open. Prescribed remote npm test passes: 27 files, 105 passed / 1 skipped, complete 150-case budget collection, 134.0 s under 240 s. Typecheck and lint passed on the same source revision. No check remains running.

## Regression sensitivity

Restoring only the original war-only funnel condition makes the unchanged extended L4 contact test fail at the collapse crawler assertion: approach remains `outside`. Current source was restored automatically in a finally block. The earlier focused and prescribed remote passes therefore cover a regression that detects the actual lifecycle change. For the remaining Alphas, inspect wide-grid connectivity and body clearance at the flag: the existing wide-body recovery only activates for goals near the courier, whereas these jobs target scripted breach points. This is a hypothesis, not a validated fix.

## Alpha grid evidence

At the first stationary flag, #296 has radius 0.55 m and no cached path. Its selected wide grid (clearance 0.7 m) cannot reach the scripted inside-breach goal; admission grids at 0.5 and 0.35 m both find a 22-node route. Start and goal are individually clear at the actual radius. This confirms a conservative-grid connectivity mismatch for #296. #372 has routes on all three grids and direct visibility at the flag, so it requires separate temporal/controller diagnosis. Full scan completes; read-only path probes run only after a stationary window is already recorded. Exact rows are in `qa.json.alphaGridScan`.

## Rejected Alpha recovery experiment

Broadening the existing wide fallback to scripted L4 goals when any breach is open did not move an Alpha placed at the captured west position in a 600-tick extension of the existing fixture. That fixture opens north, not west, so it does not reproduce the real topology. Removed both the attempted source change and the mismatched fixture extension; the validated collapse fix remains intact. Next focused reproduction must open the west segments and retain actual controller ownership. No Alpha fix is claimed.

## Renderer contact probe

Added read-only `DistrictView.wreckGroundGaps()`, reusing the existing prop ground-contact measurement against the drawn support. It returns placement identity, asset/decay, selected resident LOD, resolved placement matrix, district origin and gap. It covers only currently resident references and has not yet been exercised in browser; a residency sweep must prove coverage. Typecheck and lint pass. A native static-bake census covers 254/409 resolved placements; 155 need source fallback, so bake-only sampling cannot establish the campaign result.

## First runtime contact result

Browser pool admitted two sequential HIGH WebGL2 L3 probes on port 5018. Initial camera yielded no resident wreck rows. Camera-only positioning over `D-CORRIDOR/l3-jam-3` yielded its selected LOD0 mesh, resolved matrix Y = 0.070005506 m and gap = 0 cm. This validates the probe on one full registered-level placement; it does not cover the remaining campaign inventory or WebGPU. Raw receipt: `test-results/s140-wreckground/probe-L3-webgl2/gaps.json`, also preserved in qa.json. No simulation actor or wreck was repositioned.

## Camera sweep admission

Prepared a sequential camera-only identity-checked sweep of every resolved wreck in one registered level; recipe preserved in qa.json. L3 HIGH WebGL2 sweep attempt exited 75 before browser execution: quiet-run admission exceeded 60 seconds, quiet=false, load 3.56/3.61/3.71. No sweep measurements were produced and no browser process remains running. The earlier single-wreck runtime result remains the only validated campaign gap measurement.

## Probe LOD identity correction

Hero slots can contain temporary lower LOD prototypes. Probe now reports `meshLod` separately from slot `lod` and excludes placeholders. Typecheck and lint pass. Second bounded L3 sweep attempt exited 75 before execution (quiet=false, load 4.11/3.70/3.73); no new measurement. Earlier receipt labelled lod0 establishes slot identity only, not independently verified LOD0 prototype identity.

## Complete L3 runtime gap sweep

Third bounded attempt admitted and completed. Full registered L3 HIGH WebGL2 camera-only sweep measures all 23/23 resolved wreck identities, zero missing rows, all reported gaps 0 cm. Receipts retain matrix, origin, slot and actual mesh LOD per identity in qa.json. This is numerical grounding evidence for L3 only; requested close-up visual review and WebGPU comparison are still pending.

## West-breach focused reproduction

Native isolated reproduction now opens both actual west segments and places an Alpha at the captured position with the same inside goal. It moves 0 m over 600 ticks. Broadening wide-body recovery to scripted L4 goals still yields 0 m, so that attempted change was removed. This disproves simple fallback broadening as a sufficient fix; preserved source in qa.json. L5 browser sweep separately failed admission before execution after 60 s.

## Steering trace

Focused Alpha calls seek on all 600 ticks. Baseline path remains empty with wide goal 48386. Under the rejected broadened trigger, recovery activates at tick 241 (until 841), selects admission goal 48385, but path stays empty and movement remains zero. Thus fallback trigger alone is insufficient. Removed the attempted change. Further diagnosis must inspect path-search budget/resumption and whether the focused manual breach teardown updates every navigation blocker.

## Focused teardown correction

Earlier manual fixture teardown omitted `interactables.unblock`, which production `Barricades.break` performs. Corrected reproduction sets wall HP to zero and runs Barricades.update. Baseline still moves 0 m; broadened recovery now obtains 22 path nodes and moves 0.412 m over 600 ticks. This supersedes the earlier empty admission-path conclusion for that fixture. Recovery alone remains unverified as a fix and its source change was removed. Next diagnosis is collision/steering along the resulting route.

## L5–L7 camera sweep

Sequential HIGH WebGL2 batch completed within one reservation. L5: 25/25 measured, 0 missing; gaps [0]; L6: 0/1 measured, 1 missing; gaps []; L7: 34/38 measured, 4 missing; gaps [0]. Missing rows remain unmeasured; they are not passes. Receipts are preserved in qa.json with per-placement matrices and actual mesh LOD. L6 and four L7 targets need residency/support diagnosis before coverage can be closed. Existing L4 routing regression now uses production barricade break/unblock and passes.
