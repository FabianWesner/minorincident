# E10 — complete

Sunset Grove now has eight authored districts, cumulative W0–W5 decay, six campaign world compositions and a public composition-loading hook. Static terrain, roads, placement references, anchors, colliders, acoustic zones and surface maps come from Blender; typed gameplay anchors, routes, blockers, power outages and fire damage remain in TypeScript. Navigation is baked once per load. Repeated scenery uses the existing InstancedGroup; grass wind updates one GPU uniform, with no new per-frame allocations in E10.

## Independently verified slices

1. **Authoring and contracts:** eight small layout scripts reuse the shared Blender/palette tooling; exported layouts, roads, asset IDs, actual collider dimensions, minimap and deterministic build-cache tests pass.
2. **Simulation and composition:** extend existing Rapier/player/spatial lifecycle, deterministic navigation and TS cross-validation; all tiers/compositions reach their objectives, blockers collide, fire damage respects the existing player rules, and unload frees physics resources.
3. **Presentation and evidence:** adapt Bruno's assembly/reference/grass patterns, use E17's canonical manifest and integration-status gate, apply power/geometry decay, capture all photo spots and review all draft/decay pairs. Required checks run again after merging main.

## Acceptance criteria

| Criterion | Result | Evidence | Verification |
| --- | --- | --- | --- |
| E10-AC01 | PASS | unit.json; layouts/districts.test.ts | All eight closed bounds, connected road graphs, manifest references and lane exclusions pass; negative probes reject invalid data. |
| E10-AC02 | PASS | sim.json; districts.test.ts | Deterministic nav hashes and flood-fill reachability pass for every composition at all six tiers. |
| E10-AC03 | PASS | unit.json; layouts/districts.test.ts | Wreck/prop counts grow; powered groups and emitter counts never rise; W5 removes the canopy. |
| E10-AC04 | PASS | *-decay.json; *-window-mask.png; review.md | All eight window masks dim, W5 has three emitters per district, and the decay checklist passes. |
| E10-AC05 | PASS | draw-calls.json; playwright-headless.json | Fence, lamp, cone, tree, hedge and parked-car instances are batched; every full W5 district is below 250 draws. |
| E10-AC06 | PASS | load-time.json; playwright-gpu.json | Production L6, all eight districts, three warm loads using native WebGPU; each is below six seconds. |
| E10-AC07 | PASS | unit.json; layouts/visual-bounds.test.ts | Exported placement/collider bounds and actual solid placeholder geometry agree within 10% in X/Z. |
| E10-AC08 | PASS | *-spots.json; *-W*.png | Two photo spots × six tiers × eight districts: 96 finite-camera captures each exceed 30% non-sky pixels. |
| E10-AC09 | PASS | review.md; compare/*.png; playwright-headless.json | Draft and decay sheets opened with the image-reading tool; all mandatory items pass and optional thresholds pass. |
| E10-AC10 | PASS | unit.json; layouts/districts.test.ts | Minimap vectors agree with layout roads and downward raycasts hit actual exported asphalt along every road. |
| E10-AC11 | PASS | unit.json; layouts/crossval.test.ts | TS anchor, bounds, spawn/volume/trigger, reachable objective and orphan-warning checks pass at every tier. |
| E10-AC12 | PASS | unit.json; layouts/build.test.ts | Each district rebuilt twice in headless Blender: identical JSON/hash; TS-only changes hit cache; script changes invalidate and failures propagate. |

[acceptance-audit.json](acceptance-audit.json) maps every criterion to an actually passing tagged test in the final reports; skipped tests are excluded. Screenshots and mask measurements are in this directory. [review.md](review.md) contains the per-district one-sentence checklist judgments, and `compare/` contains draft/render and W0/W5 pairs. `previews/` contains all eight shared-studio renders and a contact sheet (simplified manifest footprint boxes).

## Final checks

| Command | Exit | Results |
| --- | --- | --- |
| npm run typecheck | 0 | No new warnings |
| npm run lint | 0 | No new warnings |
| npm run build | 0 | No new warnings |
| npm run test:unit | 0 | 57/57 tests |
| npm run test:sim | 0 | 37/37 tests |
| npm run test:smoke | 0 | 4 smoke unit tests and 12 browser tests |
| npm run verify -- E10 | 0 | 12 tagged/smoke Vitest tests, 32 headless browser tests and 1 native GPU test |
| npx playwright test --grep-invert @E10-AC06 --workers=2 | 0 | 108 full headless browser tests; no failures, retries or skips |

The full browser regression includes earlier E01–E05 and E17 tagged tests. Unit/sim suites cap at four threads; all browser runs cap at two workers and use port 3314. Final smoke/verifier commands hold `/tmp/minor-incident-e2e.lock` via `lockf -k`; the inner repository wrapper uses an E10-private lock to avoid nested acquisition of the same lock. The full 108-test run began before the new locking instruction and finished naturally; subsequent runs used the machine lock. Native headed WebGPU ran once at the end and was allowed to finish without an external timeout or kill.

Merged main through `6ab4bda4f19b31a6158d9b8b350ce33d44384946` (final implementation `f2319f5ef873ec523969d4a63de4a058286943b7`). The Sunset Fuel source export arrived during the verifier and was merged before the native GPU check; its reference status leaves runtime placeholder behavior unchanged. Typecheck, lint, build, the full unit suite and the full sim suite were then rerun on that merged revision. The verifier also completed all twelve browser smoke cases after the merge, without an additional headed run. E03 input, E04 survivor, E05 combat and E17 asset tooling/contracts are preserved. Incoming source exports are registered without changing their integration status; the new SUV and Sunset Fuel exports are normalized through the existing E17 optimization pipeline. The temporary rigid-survivor batching change was removed after E17's status gate restored the code survivor; no character renderer changes remain in the final diff.

## Performance and capture conditions

Reference machine: Apple M1 Max, 10 physical cores, 32 GiB RAM, macOS. Pinned Playwright 1.63.0: Chromium 153.0.8010.12 (revision 1243), WebKit 26.6 (2359). Production build; DPR 1, quality high. Captures use seed 1; the three native warm-load samples use seeds 0, 1 and 2. Image/counter tests use WebGL2/SwiftShader and paused deterministic photo spots. Native WebGPU measures desktop wall time, including level assembly and two ready frames, after one warm-up.

| District | W5 draw calls (≤250) | Window luminance W0 → W5 | Lowest non-sky fraction | W5 emitters |
| --- | --- | --- | --- | --- |
| D-RES | 176 | 252.96 → 67.16 | 61.5% | 3 |
| D-MAIN | 187 | 252.99 → 67.16 | 60.6% | 3 |
| D-SCHOOL | 170 | 253.22 → 57.17 | 55.9% | 3 |
| D-SHOP | 186 | 253.24 → 43.53 | 58.7% | 3 |
| D-CIVIC | 179 | 253.89 → 21.14 | 59.8% | 3 |
| D-PARK | 159 | 252.78 → 76.78 | 62.0% | 3 |
| D-ZOO | 168 | 252.95 → 69.68 | 59.5% | 3 |
| D-EDGE | 157 | 252.83 → 76.83 | 57.5% | 3 |

L6 native warm-load samples: 957.9 ms, 427.6 ms, 434.5 ms (limit 6000 ms). Data/simulation/view breakdowns are preserved in [load-time.json](load-time.json). Software-rendered `frameMs`/`fps` fields in [draw-calls.json](draw-calls.json) are paused/shared-machine artifacts and are not presented as real GPU frame-rate measurements.

The largest L6/W5 player-only fixed-step benchmark has 191 colliders, 3600 measured ticks after warm-up: p50 0.046 ms, p95 0.189 ms, p99 3.048 ms, max 13.504 ms. This bounds the E10 navigation/static-collider/fire workload and includes shared-machine scheduling spikes; future infected/civilian AI is outside this measurement. See [sim-perf.json](sim-perf.json).

## Deviations and known issues

No acceptance criterion or source-of-truth specification was changed or weakened. Assets below `integrated` use code placeholders, as required; their final artwork is outside this epic. Studio previews deliberately show placement footprint boxes, while runtime screenshots provide the vision evidence.

**Follow-up task — A8 prop density:** all eight districts have fewer small props and less clutter than their draft sheets. When scenery assets advance to integrated, add draft-specific small dressing to these authored layouts and repeat the same photo review without exceeding the 250-draw budget. A1–A4 and E1–E2 pass; A5–A7 pass (75% of A's optional items), and E3–E4 pass (100%). The explicit 70% rule therefore passes AC09 while retaining this honest visual limitation.

Cat-perch/crow-roost and other future-use anchors are intentionally reported as orphan warnings until their owning epics consume them. Interactive object behavior and mission/checkpoint/progression scripting remain at their existing future-epic integration points. There are no unresolved acceptance-test failures.
