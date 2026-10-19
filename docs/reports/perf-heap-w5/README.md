# perf-heap-w5

## Status

Committed partial fixes and evidence. E25/E28 collected heap, L5 ash peak, repeated rocket stress and all four L5/L7 lifecycle cases pass. **The task is not closed:** the last measured low L7 district/horde maxima and L4 transitions remain red. The latest corpse bounds/headwear and alarm admission changes await native measurement. No deployment or merge.

## Measurement contract

E18 defines JS heap in decimal MB. Its existing `T-E18-05` collects garbage and reads CDP `Runtime.getHeapUsage.usedSize`. The light-lab test omitted its heap assertion; storm and rocket instead read `performance.memory.usedJSHeapSize`, including backing stores. The shared helper now collects three times across frames and uses the existing E18 measurement. JSON retains `backingStorageSize` and raw peak values separately. **These are corrected measurements, not equivalent reductions in physical memory.** Limits remain 400/250 MB.

Fixed-step sim samples use the existing `simTickMs` world-step maximum; per-frame totals remain separate evidence. L4, district, horde and rocket checks now enforce the literal 50 ms maximum on both tiers. L4's line-break probe keeps the real clock running through the trigger and fuel-truck chain; the former paused setup stepped past that event before sampling. Frame, sim, population, effect and lifecycle limits are not relaxed.

Normal L4 timing now omits the optional per-draw category profiler (`profile`), matching the ordinary game render path and other E18 timing tests. `L4_PERF_PROFILE=1`, `L4_CPU_PROFILE=1` and `L4_TIMING_KEYS=1` retain diagnostic runs. Draw/triangle counters and every acceptance assertion remain active. The recorded L4 numbers below still include the profiler; the ordinary-path repeat is pending.

## Per-item evidence

Large raw JSON traces are stored losslessly as `.json.gz` (`gzip -dc file.json.gz` to read). Numbers are high/low unless stated otherwise. `before/`, `diagnostic/`, `after-occlusion/`, `cold-builds/`, `gameplay-lights/` and `shared-native/` retain the successive stable-build measurements.

| Item / test ID | Before | Latest valid measured result | Status / cause and fix |
| --- | --- | --- | --- |
| E25 light lab `T-E25-14c` | Raw uncollected 775.60/571.06 MB | Collected **131.71/87.80 MB**, frame p95 **5.5/11.9 ms** | Pass. Add the missing assertion and use the E18 JS-heap contract. |
| E25 night `T-E25-14/14b` | Missing collected heap gate | **157.67/100.52 MB**, frame p50 **6.4/17.4 ms** | Pass existing frame and new heap gates. |
| E28 storm `T-E28-10-frame` | Raw 547.66/263.78 MiB | **103.92/68.76 MB**, frame p95 **5.1/6.0 ms** | Pass. Replace the inconsistent memory counter; preserve backing-store evidence. |
| L5 ash `T-E23-19` | Ash-peak proof missing | **102.63/79.01 MB**, maximum **12.6/37.8 ms**; **5 followers, 13 fires, 37 corpses** | Pass. Assert collected heap; the walking probe reads the player rather than cloning the whole world each frame. Difficulty is unchanged. |
| L7 horde `T-E29-19-encounters` | Frame p95 **15.9/52.4 ms** | p95 **16.6/32.8 ms**, maximum **49.5/64.7 ms**, world sim p95 **2.1/4.2 ms**, heap **86.1/69.48 MB** | **Low maximum red.** Fix full-batch bar raycasts and duplicated frozen material graphs. Latest bounds/headwear work unmeasured. |
| L7 district `T-E29-19-district` | Low p95 **34.2 ms**, maximum **128 ms**; late blast/corpse builds | p95 **11.8/33.6 ms**, maximum **17.7/51.5 ms**, sim **2.0/4.3 ms**, **zero late node builds or GPU pipeline creations** | **Low p95/max red.** Warm the gameplay light list and share corpse graphs. Remaining spike is at settlement; latest bounds/headwear work unmeasured. |
| L7 rocket `T-E29-19-rocket` | Maximum **25.6/67.3 ms**; heap red | Maximum **25.0/42.8 ms**, p95 **8.0/18.4 ms**, sim **1.4/2.6 ms**, heap **69.17/52.05 MB** | Pass. Correct heap measurement and remove repeated full-world snapshots from the frame probe; retain counter agreement and full populations. |
| L4 `T-E22-20` | Low turn **60.7 ms**; stock gate allowed 80 ms | High turn/tank/break **17.9/12.7/29.6 ms**; low **62.8/33.0/73.8 ms**, low world sim p95 **6.7 ms** | **Low red.** Strict real-time gate, lightweight beat counters and pooled props are in place. Final single-owner alarm admission and ordinary-path timing await measurement. |

### Lifecycle: unchanged 10% gate

`T-E23-19-lifecycle` and `T-E29-20-lifecycle` pass both tiers after target → L1 → target with accessibility settings retained.

| Level / tier | JS heap growth | Geometry growth | Texture growth |
| --- | ---: | ---: | ---: |
| L5 high | +3.29% | -3.51% | +6.14% |
| L5 low | +5.18% | -4.87% | +2.53% |
| L7 high | -2.57% | -5.11% | +1.82% |
| L7 low | +3.03% | -5.34% | +2.50% |

## Causes and source changes

1. **Health-bar occlusion multiplied placement work by the whole batch.** The profile stack was `HealthBars.update → DistrictView.occludesBar → InstancedMesh.raycast → intersectTriangle`. Broad phase selected one placement, then raycast its entire building batch. Geometry boxes were absent. `InstancedGroup.occludesReference` now uses the selected placement's actual drawn matrix, including animated doors, hidden roofs and compacted interiors. Boxes are computed during loading; bars outside the viewport are rejected before physics/mesh queries. Scratch references are cleared after each query. `T-E29-20-occlusion` compares full-batch and selected-placement results over rotated/scaled placements. All five existing bar browser tests passed.

2. **L7 low warmed the wrong light list.** Gameplay disables its city-wide moon pass in `updateLights()`, while loading previously called only `lighting.update()`. First-blast materials kept their material key but changed environment keys. Warm-up now calls gameplay light selection. The low district's five late pipeline creations fell to zero.

3. **Separate civilian model pools copied the same frozen shader graph.** Captured cold builds showed five distinct frozen material UUIDs derived from one civilian source UUID. Frozen graphs are now shared by source material across pools, with reference-counted disposal; geometry, tint, bounds and permanent bodies remain independent. `T-E29-19-frozen` verifies the material survives one owner's disposal and is disposed exactly once after the last owner. Late district node builds fell to zero.

4. **Settlement repeated bounds work and deferred headwear baking.** Each new body rescanned all prior instances in its page. Bounds now extend the exact same sphere union from the stored float32 matrix, using cached local bounds. The 260-body growth test compares incremental and full recomputed spheres and checks containment. L4/L7 now use the existing L6 headwear-pose preparation path behind loading. Native effect remains unmeasured.

5. **L4 alarm conversion repeatedly admitted actors that were immediately repositioned.** Node traces found 36 admission calls for nine low-tier alarm identities: civilian creation, a temporary infected record, same-ID conversion and the authored exit. The temporary record now supplies data without owning placement. The alarm's synchronous final exit owns its one collision check; ordinary spawns/conversions keep their default checks. IDs, RNG calls, appearance and populations are retained. `T-E22-20-admission` verifies ordinary conversions and spawns; `T-E22-20-alarm` verifies both full alarm populations and one final admission per identity. The complete L4 sim suite passes. Native timing remains unmeasured.

6. **Prop presentation allocated every frame.** `RoutineProps` reuses gun matrices/muzzle vectors and QA hand arrays. Dropped props reuse scratch transforms/bounds, and their geometry boxes are built while loading. `T-E22-20-props/dropped` verifies exact hand/muzzle values and rotated cup ground clearance. No probe is disabled.

### Rejected experiments

An identity-matrix VFX experiment did not remove cold builds and was reverted. A borrowed `NavGrid.visible` set/collector workspace passed correctness checks but was slower in an isolated, alternating Node benchmark (median 38.97 → 56.98 ms for 54,000 queries per sample); it was also reverted. `node/` retains traces and the benchmark, not production changes.

## Visual QA

Eight catalog scenes cover light lab, storm, L5 ash, rockets, visible/occluded bars, held props and separate civilian corpse pools. The standard matrix filters include `perf-heap-*`. Each scene uses a game camera with high/low and zoom 0.5/1.0/1.5 on WebGL2 and WebGPU. **The earlier seven-scene stable build passed all 84 rows. The final eight-scene repeat was not admitted: the guard timed out after 30 minutes (exit 75).**

Inspected sheets on both backends: visible pink bars track actors; the house roof hides the occluded bar; close crops omit out-of-viewport bars. The low occlusion crop intentionally fills the frame with the roof over its target, so it is not a courier-readability approval. The held-prop high game-camera sheet shows the orange-shirted coffee holder between the officer and green soldier, with their accessories following the same poses across all four frames.

L5 peak captures show dense falling ash and sunset haze, the burned bus/trucks, corpse/debris fields and five pink survivor bars around the courier. The low portrait keeps objectives and touch controls below the subtitle. Storm low shows dense rain, the red sedan, warm window spill and wet reflection streaks with a readable courier. Light lab shows the broad bright pool and long purple crowd shadows; its strongest pool washes out part of the courier. No change here claims a lighting-readability fix.

## Validation and run discipline

- Fresh build, typecheck and lint pass. Final-source full units pass on Hetzner: **293 files / 1,641 tests**, one file / nine tests skipped, 220.29 s.
- Full units before the final alarm/bounds refinement: **293 files / 1,640 tests pass**, one file / nine tests skipped, 231.29 s.
- Latest fallback-material regression: **14 tests pass**, including independent plain-material snapshots.
- Latest render group: **16 tests pass**, including material ownership and incremental bounds equivalence.
- Final alarm/admission/civilian group: **50 tests pass**. Complete L4 suite: **13 files / 49 tests pass**, two existing skips, 297.11 s.
- Earlier full unit/sim/levels run: **504 files / 3,161 tests pass**, with one unchanged L10 route timing red under concurrent load. Its isolated rerun passes both tiers at the original 4/6 ms limits (2 tests, 46.97 s). The asset-validation 300 s timeout likewise passes alone (17 tests, 143.64 s); no timeout or budget was raised. The subsequent full unit/sim/levels repeat passes: **3,168 tests**, exit 0, 2,995.15 s. That snapshot predates the final scoped alarm/bounds/fallback refinements; final units, the complete L4 suite and targeted render/admission groups cover those changes. See `validation.json` for exact commands and summaries.
- Native batches use headless Chrome, ANGLE Metal, one worker, fresh static builds, unique ports and `quiet-run.sh`/`e2e-lock.sh`. Every quiet reservation was released within 20 minutes, with other work between batches. One early storm-low navigation result was invalid because dist was rebuilt during preview; it was discarded and both tiers were rerun against a stable build.
- Final browser admission waited 30 minutes behind two other headless roots, then exited **75** without starting a browser or holding a slot. No subsequent browser queue was started. See `browser-admission.log`.
- **Unmeasured on final source:** native L4/L7 timing after bounds/headwear/alarm changes and ordinary-path L4 profiling correction; final eight-scene WebGL2/WebGPU matrix (96 rows); standalone E18 desktop/device, memory and regression repeats; native WebGPU transition timing; `npm run verify -- E22/E25/E28/E29` receipts. Earlier native passing results and 84 matrix rows do not certify these final-source gates.

No population, persistent corpse, effect cap, difficulty configuration, asset or budget is removed or relaxed. No forbidden directories or generated `staticCollision.ts` changes are included.
