# Mega and buildings — work in progress

**Browser QA needed.** No browser capture or visual review has been performed.

The L10 coarse pursuit advanced directly along graph links without testing solids. Its resident handoff also trusted nav clearance, and a blocked coarse leg initially stalled because movement was already marked processed for that tick. The resident collision handoff now uses detailed navigation until it has made progress. L9 uses a separate scripted Mega sighting.

A whole-graph collider scan at Mega radius 1.05 m found these building intersections before waypoint changes; the same scan found none afterwards:

| Link | Before | After |
| --- | --- | --- |
| 8 → 9 | bld.cure-duplex:12/geometry-1 | 0 |
| 9 → 10 | bld.house-d:539 | 0 |
| 10 → 11 | bld.house-d:539 | 0 |
| 25 → 26 | bld.cure-motor-shelter:2995 | 0 |
| 37 → 38 | bld.house-c:2173 | 0 |
| 39 → 40 | bld.mainstreet-brick:2190 | 0 |

The graph check samples every 0.5 m against body-height district decay colliders using conservative AABBs. It does not prove clearance against every dynamic blocker or all off-graph joins. The native per-tick complete/passive probe observed zero intersections after allowing 10⁻⁸ m numerical tolerance; the three initial reported contacts were tangencies with depths around 1.7 × 10⁻¹⁴ m. L10 passive stops input during charge; L9's acceptance stationary policy still follows its driving route. The probe has not been run against the unmodified baseline, so no before count is claimed for native runs.

A controlled resident pressure-mode wall probe reached the far side in 457 ticks over 26.66 m, versus 178 ticks over 16.02 m unobstructed. Before the handoff fix it stalled for 3,600 ticks at x = −2.08 m.

Validation: typecheck and lint pass; focused native overlap/detour and graph probe passes; `qa:threat` on the route change reports 0 flags. Remote `npm test` passed before the final route edit (105 passed, 1 skipped). Remote L9 acceptance reported L9-04 failure and 16 incomplete rows. Remote L10 acceptance after the route edit reported six failing level rows and six incomplete rows: in particular L10-07 low stationary maximum Mega step was 1.1199 m (limit 1 m); L10-02 fixture immunity and L10-11 crowd limits also failed. The command exited 1. These results do not establish acceptance, and L10-07 needs investigation. Report output under fix51-verify was restored.

Open: investigate the L10-07 displacement; verify coarse handoff and nonresident route joins against unloaded solids, authored barricade-only breach, full acceptance rows and current remote unit suite; perform browser QA.

## Follow-up: L10-07

The low stationary acceptance scenario reproduced a 1.034 m step at tick 70983. Phase instrumentation traced it to accumulated crowd separation corrections, not a special attack. Mega separation is now limited to 0.2 m per tick; the same local probe measured 0.2485 m maximum. The native overlap and continuity regression passes after this change. Full threat audit attempts on the updated code timed out at 600 seconds locally and remotely under load. Shard 2 completed within 592 seconds, but shard 1 remained queued for over 20 minutes and the attempt was stopped; the merged verdict is outstanding. The earlier zero-flag audit predates the separation change. Remote acceptance and unit checks also need rerunning on current code.

## Sharded threat audit and unit rerun

The missing first shard subsequently completed in 341 seconds. Merging it with the saved second shard from the same code revision (`53e96b38`, followed only by report edits) produced 0 threat flags, including L9/L10. Two unchanged remote `npm test` attempts on the current code timed out at the 240-second runner limit under load; both showed the long combat and L4 contact cases exceeding their individual limits before the overall timeout. No completed current-code unit result is claimed.

## Temporary route avoidance

Temporary stuck-link avoidance no longer starts the authored breach timer. A focused arena probe passed for temporary and explicitly blocked links; typecheck and lint passed. The L9/L10 threat diagnostic completed its native stages, but its partial selection is not a full gate. Its L10 skilled dispersal-assault wave recorded a first-attack flag also present in the earlier merged audit; the audit summary counts only its selected gate flags. The previous full zero-flag result predates this change.

Two further unchanged remote unit attempts on this change did not pass: the first completed with 104 passed, one skipped and the combat test timing out at 30 seconds; the second reached the 240-second overall timeout. The current-code unit gate remains open.
