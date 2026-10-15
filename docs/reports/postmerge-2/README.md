# October 15 merge regression repair

Baseline: `2fb62b3b1`; first remote failure list came from `7cf1b48bf`. No acceptance threshold, quality budget, reference asset, or specification was changed.

## Merge attribution and fixes

| Failure | Merge / interaction | Repair |
| --- | --- | --- |
| L2 rescued person still at (50,30) | `7cf1b48bf` changes finale pacing; the courier reaches the gate while a protected child still has street legs left | Observe the remaining authored route before the handover. Every released entity must still end at the checkpoint/gate, turned or down. |
| L4 collapse engagement density | `7cf1b48bf` extends the route; `5e1c8d2c1` keeps sheltering humans visible, changing camp fights and cap use | Give designated street groups a share of the existing 120/60 slots; spend each slot only when its group actually emerges. Preserve protected egress and offscreen admission. Add the final Harbor block to the encounter catalog. |
| L4 perimeter bark | `5e1c8d2c1` activates the visible perimeter at the alarm, and the parked column blocks the old approach | Advance to hold and start a real boundary attempt on clear pavement. Keep all containment and escape assertions. |
| L4 panic/cohort/queue assertions | `5e1c8d2c1` keeps people visibly cowering outside closed doors, represented by a calm state and `npc-cower` story clip | Count the visible hiding animation as hiding; retain the original percentages and zero queued-person limit. |
| L5 survivor-2 restore finds a third person | `7cf1b48bf` swaps hardware/apartment shells but leaves Mia in the old apartment coordinates, beside the new cellar | Put Mia in another real Harbor apartment, preserving all five hiding places and their 25 m separation. |
| L5 idle courier dies at the opening | `7cf1b48bf` moves the exit into the old Harbor wanderer's patrol | Move that existing wanderer to Lakeshore; retain population and ordinary sight acquisition. |
| L5 follow speed | The moved opening changes follower/corgi approaches and exposes displacement beyond the follower speed contract | Include crowd separation in the 3.8 m/s follow cap; preserve forced combat displacement. Isolate graph/order and movement fixtures from combat, and put the bite-timing fixture on open pavement. |
| L1 firefighter bark | `5e1c8d2c1` changes `Outbreak.ts` refuge handling while the test courier waits unattended; replaying that component before/after reproduces pass/fail | Protect the spectator courier in the firefighter durability fixture. The firefighter remains attackable; the original targeting, survival, bark and checkpoint assertions remain. |
| Sandbag/fence overlap | `7cf1b48bf` moves the northwest street-end pallet away from the cellar but into a privacy fence | Move the pallet clear of both doorway and fence; retain the overlap baseline unchanged. |
| L1 respawn crowd | Forecourt diversion can replace respawn delay; nearby infected pursuing other people can cross the cleared ring | Preserve the four-second pause before forecourt AI, including nearby pursuers outside the nine-metre ring. Keep checkpoint coordinates and the original clearance test. |
| Ally stillness after cap reservations | A soldier or armed civilian abandoned its unfinished move to cover when its target died | Finish the same tactical step without a target, as officers already do. Regression cases cover all three armed roles. |
| Reproducible low-tier tank hitch | New war timing exposed a cold civilian-corpse page: L4 phones freeze LOD2, but startup warmed LOD1 | Prewarm the actual frozen band, remove per-vertex matrix copies/iterator allocations, and retain semantic xyz normals after backend padding. Keep body appearance, permanence and all E18 thresholds. CPU profile measured a 140.9 ms view update with synchronous corpse-page creation. |
| Occluder footprint | Already fixed by `2fb62b3b1` | Confirmed by remote rerun; no additional footprint changes. |
| Static / L10 loaded-run timeouts | Declared outside this repair's scope | Record broad-suite results and isolated reruns below. |

Historical source snapshots were replayed on Hetzner. Compact results are in `bisect/`; complete temporary exported source trees were removed. Before the boundary/stretches pair, the selected L1 and L5 checks pass. The boundary's new visible cower representation passes the same panic percentages once recognized. The placement overlap and L2 rescued-person check pass immediately before stretches.

## Camera and visual QA

The first real mission captures exposed a separate consequence of the moved cellar: the zoom-1 lens entered the opposite apartment, filling the frame with masonry around the bounded reveal. Fairhaven's follow rig now stops its lens before any building intersecting the focus-to-lens segment, then eases back toward the requested zoom. At a close corner it raises the lens on the street side of the facade to preserve the minimum viewing distance. Moving the lens above a roof was tried and rejected after captures showed the roof still filling the frame. Simulation and render camera poses agree. The cutout remains bounded; the simulation and renderer use the same corrected rig. A regression test uses the actual opposite apartment bounds and the real exit coordinates.

Courier follow scenes use the production follow rig so the catalog reproduces this clearance behavior. Matrix scenes cover hold perimeter, relocated cellar exit, Mia's apartment, the Lakeshore camera corner and the final Harbor encounter at high/low, zoom 1.5/1/0.5, WebGL2/WebGPU. Full mission captures additionally exercise L5's actual unbarring and exit, from the shared mission checkpoint.

### Reviewed captures

- [Hold perimeter, both renderers/tiers/zooms](perimeter-contact.jpg): the low fence and military signs form the same continuous corner in every view. The courier stays on its inside; the plaza paving and figures remain visible. Zoom 0.5 shows the fence posts and footing clearly.
- [Actual L5 exit, both renderers/tiers/zooms](cellar/contact.jpg): the courier and corgi stand on clear Harbor pavement beside the hardware doorway. The opposite apartment no longer fills the frame. Zoom 0.5 retains the doorway edge and visible ground around both characters. Low quality omits particles while preserving the same doorway and pavement geometry.
- The Harbor tail sheets show the street group approaching the courier near the last block. Mia's sheets show the other Harbor frontage and open road. The Lakeshore corner sheets show the courier in front of the fence, with no enclosing roof across the frame.
- Matrix results: [WebGL2 30/30](webgl2/index.md), [WebGPU 30/30](webgpu/index.md). Each includes both quality tiers and zoom 1.5/1/0.5.
- The eight real exit captures assert the actual backend/tier, settled follow position, original draw/triangle limits, and dominant colour share below 0.5. [Proof](cellar/proof.json): 167–179 draws and 173,605–262,961 triangles.

## Validation

`npm run typecheck`, `npm run lint`, and the fresh production build pass. Heavy checks ran on Hetzner; no local Vitest sweep ran.

The broad run completed with 1,920 passes, nine existing skips, and four failures on its earlier source snapshot (L4 pressure and three L5 fixtures). Complete touched-file reruns supersede those results. [Validation inventory](validation.json) records each source run and the latest complete result for every file; the inventory consolidates complete file reruns and retains the original broad-command status.

The full unit inventory is green, including static, placement and occluder-footprint guards. The isolated L10 completion check passes. Final touched simulation checks pass (73 tests), including all-level respawn, armed ally movement, L4 systems, navigation, L2 reporting and L5 combat.

The browser driver also resumes the authored street route after a collapse death. Its old south-only rejoin conditions clicked later north/west legs diagonally through the fallen camp; every real click and combat check remains enabled.

The unchanged collapse gate passes at high/low: 33/9 unique engagements, 21.66/6.91 per minute, zero deaths, peaks 120/60. The authored route is 151/152.5 seconds at walking speed. [Traces](collapse/).

A concurrent browser run exposed a screenshot-driver overrun to x=69, beyond the roof-band endpoint x=66; the failing probe hit open road, not a building. The real-clock walk now pauses at its original endpoint in the browser, retaining all pixel and route thresholds. The nine targeted browser cases pass; the respawn case also passes three consecutive repeats without retry. The full 100-case browser gate recorded 98 passes, one driver failure and one driver flake; the three corrected-driver cases then passed without retry. [Latest case inventory](browser-validation.json) is 100 expected, zero unexpected, zero flaky. The six simulation smoke checks also pass.

The corpse warm-up correction has 23 passing rendering regressions. Additional [WebGL2](corpses-webgl2/index.md) and [WebGPU](corpses-webgpu/index.md) matrices pass 6/6 each, including both tiers and all three zooms. Reviewed sheets retain the same three bodies, clothing, hats and ground contact after frame 240.

### Final E18 native GPU gate

All four unmodified stock checks pass on the final build, under `tools/perf/quiet-run.sh`, one headless Chrome worker and Metal WebGL. Phone cases use the existing 4x CPU throttle. Each reservation was bounded to less than twenty minutes and released between batches.

| Check | Measured frame target | Sim p95 / hitch |
| --- | --- | --- |
| L4 high | war/collapse p95 9.5 / 9.4 ms (limit 14) | sim 2.3 ms (limit 4); largest beat hitch 18.7 ms (limit 50) |
| L4 low | war/collapse p50 23.9 / 22.1 ms (limit 33.33) | sim 5.5 ms (limit 6); tank 61 ms, largest beat hitch 64.5 ms (limit 80) |
| L5 high | p95 9.3 ms (limit 14) | max 16.1 ms (limit 50) |
| L5 low | p50 21.5 ms (limit 33.33) | max 48.1 ms (limit 80) |

Original population, firing, corpse, follower, precipitation, draw-call and triangle guards all pass. Timing evidence is native WebGL; both renderer paths have the quality/zoom visual and draw/triangle matrix coverage above.

The first final low run failed with a 182.2 ms tank-window hitch; isolated repeats reproduced it. [CPU diagnosis](perf/hitch-profile-summary.json) identified cold corpse-page creation in view update, not a sim-step overrun. Correct-band prewarming alone reduced the hitch to 131.4 ms. Direct pose transforms, dense index remapping and semantic xyz normal buffers removed the remaining cold work: the final stock check measures 61 ms. Earlier failed attempts remain in `perf/` with explicit names; final canonical E22/E23 records and [quiet conditions](perf/conditions-final.jsonl) contain the passing build.

No tests, budgets, or PO scope were relaxed. No specification or reference asset changed.
