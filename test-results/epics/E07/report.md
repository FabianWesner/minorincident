# E07 — Infected AI, Archetypes and Hordes

Final validation uses the frozen main base `b5dcd1c`, merged in `829f7b1`. No later main changes or asset registrations were adopted after the orchestrator’s stop instruction. The implementation and its evidence are committed separately.

## Built

Twelve human archetypes and six animal roles share fixed-step, serializable AI state. The implementation adds sight/hearing, budgeted district/grid navigation and group flow fields, collision-safe steering, telegraphed attacks and specials, corpse retention and leg-loss conversion, weighted spawn queues/waves/ambient population, spline migrations and a prewarmed entity pool. Adult-only E08 grab/turn hooks preserve mapped civilian variants; E26 supplies borrowed medium prop bodies for gorilla throws and owns their lifetime.

The crowd renderer merges each archetype into one rigid-part instanced GPU batch with procedural clip textures, vertex color/AO, eye emissive, distance animation throttling, blob shadows and shape-distinct telegraphs. It uses the asset registry and code placeholders for every entry below `integrated`. The horde/readability/animal/maze fixtures exercise behavior without changing other epics’ production level activation. E10 district loading, centered ground and snapshots remain supported.

Reuse: Bruno Simon’s MIT `Zones.js` and `InstancedGroup.js` at reference revision `41046b5`; the repository’s E17 crowd texture/matrix helpers and existing survivor rigid-part clips/placeholder; existing combat Damage, Status, Rapier and spatial hash. No dependency was added.

## Acceptance evidence

The final executed-tag mapping is recorded in `acceptance-coverage.json`.

| Criterion | Tagged tests | Result and evidence |
| --- | --- | --- |
| E07-AC01 | T-E07-01 | PASS — `vitest.json`: twelve validated human roles spawn with authored HP and speed. |
| E07-AC02 | T-E07-02, 02b | PASS — `vitest.json`: cone/range exclusion, an actual facing-independent pistol noise event, catalog gunshots, silent melee misses and bounded melee-kill noise. |
| E07-AC03 | T-E07-03, 03b, 03c | PASS — `vitest.json`: collider-safe 40 m / 900-tick three-district maze path, resumable A* budget and E10 centered-ground regression. |
| E07-AC04 | T-E07-04 | PASS — `separation.json`: 100 runners, 600 ticks, 4,950 pairs/tick; average deep overlap below 2%. |
| E07-AC05 | T-E07-05 | PASS — `vitest.json`: every damaging role produces positive combat-hit damage with a matching source/attack telegraph at least 21 ticks earlier (Brute 48); includes death explosion and DoT causality. |
| E07-AC06 | T-E07-06a–f | PASS — `vitest.json`: scream radius, friendly-fire blast, front shield, once-only revival, charge displacement and timed/hit-broken crawler grab. |
| E07-AC07 | T-E07-07, 07b, 07c | PASS — `vitest.json`: 18 m exclusion, expanded footprint/numeric frustum and collider exclusion, including the actual selected cat perch and its elevation. |
| E07-AC08 | T-E07-08, 08b, 08c | PASS — `vitest.json`: both quality caps, queued waves/migrations and cap-safe revival retry. |
| E07-AC09 | T-E07-09 | PASS — `migration.json`: 150 arrivals within time tolerance; fan-out positions and subsequent outward movement. |
| E07-AC10 | T-E07-10, 10b | PASS — `pooling.json`: 18,000 ticks with 150 living infected cycling through natural corpse-cap cleanup; stable object identity/counters and refreshed collision radii across recycled archetypes. |
| E07-AC11 | T-E07-11 | PASS — `sim-perf.json`: 200 chasing infected; p95 below 4 ms after 120 warm-up ticks and 600 measured ticks. |
| E07-AC12 | T-E07-12, bake, 12-native | PASS — `render-perf.json`, `mixed-render.json`, `webgpu.json`, `horde-200.png`, `horde-archetypes.png`, `webgpu.png`: fixed instanced scene graph, actual renderer draw delta, all-archetype crowd and native WebGPU. |
| E07-AC13 | T-E07-13 | PASS — `horde-readability.png`, `player-mask.png`, `telegraphs.png`, `bloated-windup.png`, `compare/readability.png`, `review.md`: 60 golden-hour runners and Checklist D. |
| E07-AC14 | T-E07-14 | PASS — `vitest.json`: corpse visible for 2,700 ticks, sinks then releases at 2,760; oldest-first cap of 100. |
| E07-AC15 | T-E07-15 | PASS — `vitest.json`: surviving leg-targeted runner becomes speed-2 crawler behavior in Full/Reduced/Off with detachment only in Full. |
| E07-AC16 | T-E07-16 | PASS — `vitest.json`: four dogs flank from at least 90° spread; 24-tick telegraph, 36-tick knockdown. |
| E07-AC17 | T-E07-17, 17b | PASS — `vitest.json`: layout perch, hidden query/aim-assist exclusion beyond 5 m; leap/cling timer and attack/distance escape. |
| E07-AC18 | T-E07-18, 18b, 18c | PASS — `vitest.json`: circling/dive waves, individual explosion/ray/shotgun damage, 300-tick scatter, weighted cap and dead-flock instance cleanup. |
| E07-AC19 | T-E07-19a, 19b | PASS — `vitest.json`: nearest medium Rapier prop throw with actual momentum damage, sixfold barricade hit and 90-tick lion pin/two-attack escape. |

## Verification

Final frozen-base command results are recorded in `final-main-checks.json`; individual output is in `logs/`. `final-checks.json` retains the preceding complete regression run, including all 126 browser tests across desktop, mobile and WebKit. All seven commands exited 0: 68 unit tests, 143 simulation tests, 42 selected Node tests and 14 selected browser tests. Smoke passed three Node tests and 12 browser tests. There were no browser retries or newly introduced warnings. Per the final orchestrator rule, no cross-epic browser regression was repeated; it will run centrally on main after merge. The prior full regression passed 126 browser tests with zero skipped, unexpected or flaky results on implementation `8740dae` / main `bce6bc2`; the final frozen-base refresh followed the cat-perch safety fix and last merged asset-source reconciliation. Native headless WebGPU passed one test on the real Apple/Metal adapter. All 19 criteria have executed passing tagged tests; Checklist D passes all five items.

| Command | Exit |
| --- | --- |
| `npm run typecheck` | 0 |
| `npm run lint` | 0 |
| `npm run build` | 0 |
| `npm run test:unit` | 0 |
| `npm run test:sim` | 0 |
| `npm run test:smoke` | 0 |
| `npm run verify -- E07` | 0 |

## Performance

200 infected simulation p95: **0.902042 ms**, below the unchanged 4 ms limit. The 100-runner separation proof averages **0.4694%** deep overlap against 2%. All 150 migrating infected arrive in **23.116667 s**, versus 23.112890 s expected, and fan out within 4.5 m.

The 300 s pool proof performs **45,000 reuses**: allocated records remain **350 → 350**, with 100 retained corpses. The 200-runner WebGL frame has **41 total draws**, **39** after crowd removal, proving a **2-draw** crowd contribution. The mixed 18-role scene uses **18 total crowd draws across 17 active role batches and shared presentation**, a fixed 21-node scene graph and zero non-instanced crowd meshes. Native WebGPU uses **3 crowd draws / 42 frame draws**; its 16.7 ms frame is a snapshot rather than a render-p95 measurement. SwiftShader frame rates are diagnostic, not the native render performance claim.

Measurements come from the committed JSON artifacts rather than estimates. Environment: Node 22.22.2, arm64 macOS 27.0; browser tests use production output, port 3318, pinned Playwright Chromium/SwiftShader with at most two workers and a machine-wide lock. Vitest is capped at four workers; final simulation and selected verification use one worker under the machine-wide lock to isolate wall-clock timing from other lanes’ browser load. The outer global lock remains held while the child browser wrapper acquires its private inner lock. The native WebGPU proof uses one worker and records its Apple/Metal adapter.

## Deviations and integration

- Corrected the AC13 reference from nonexistent test-concept §7.4 to §7.1 Checklist D. The readability requirement and pass threshold are unchanged.
- Main landed standalone SUV, gas-station, school, playground, police-checkpoint, supermarket and police-officer exports during this lane. Minimal source/LOD registry mappings and optimized public exports repair the existing E17 supplied-export gate; asset art status is unchanged. Later main registrations of SUV/gas were preserved during merge. This integration adds no new asset designs.
- Main also supplied elderly/child civilians, firefighter, national guard and tunnel portal exports. Their source/LOD mappings, authored palette accents and public optimized outputs were registered to retain passing E17 regression gates; adult runtime exports use the existing root-scale normalization. The adult-height test excludes the explicitly named child, consistent with its existing brother/animal exceptions. Raw exports and asset statuses were not changed.
- The first and only headed WebGPU project attempt exposed a ten-buffer layout against WebGPU’s guaranteed eight-buffer limit. Packing all static crowd attributes into one buffer reduces the layout to five buffers. The unchanged E07 native proof then passed in headless Chromium on the real Apple/Metal adapter; the failed headed attempt is retained in `webgpu-headed-attempt.json` and its log, and the headed project was not repeated. Normalized integer GLB positions/normals are converted to float before rigid-part transforms, with a regression test proving transformed coordinates no longer wrap.
- The final pool test checks object membership on every tick but accumulates its assertion result, removing millions of assertion-framework calls without changing the five simulated minutes or allocation requirements. An earlier shared-load run timed out and measured 4.159 ms p95; the final simulation run uses one worker and the machine-wide browser lock. The strict 4 ms criterion is unchanged.
- Main’s already-present flashbang, helicopter-pilot and box-truck exports received source/LOD mappings and optimized outputs before the stop instruction. No assets arriving after the last merge were registered.
- E06 catalog attacks, pickups, shield/adrenaline effects and action presentation were preserved in the merge; actual E07 infected consume its authored noise events and emit `ai.alerted` without making melee misses noisy.
- The E01 contract test now exercises the delivered E07 spawn/killAll methods instead of requiring them to remain future-epic stubs. E12/E19 stub checks remain.

## Known issues and boundaries

No open E07 implementation issue is known. Below-`integrated` art remains the required code fallback; this is not final asset approval. E08 civilian lifecycle and E26 prop ownership are exposed as integration hooks, not implemented here. Pooling evidence proves stable entity records after warm-up; it does not claim that the existing world’s event/snapshot/physics APIs never allocate. Vision review is scoped to infected/player/telegraph readability and the two catalog pickups in the photo fixture; it does not approve later HUD or full district art.
