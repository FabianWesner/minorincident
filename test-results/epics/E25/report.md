# E25 closure audit

Audited main / initial lane HEAD `baf1fb5a3848c18d1ad34cb8ce1c0fcc715c0f97` before implementation, 2026-10-10. A test tag alone is not a PASS: existing evidence and fresh validation are distinguished below. No budgets or criteria changed.

| AC | Initial audit | Evidence / missing behavior |
| --- | --- | --- |
| E25-AC01 | GAP | WebGPU lighting/tone-mapping spike and decision report absent; manual WebGPU policy applies. |
| E25-AC02 | PASS (existing evidence) | tests/unit/render/e25-lighting.test.ts validates shipped anchors and rejection cases; rerun pending. |
| E25-AC03 | GAP | Only tests/visual/e25-deferred.spec.ts placeholder; LightField has facade clipping but no static visibility polygons or trailer mask proof. |
| E25-AC04 | DEFERRED | WebGPU requires manual validation per repository guidance; automated headless parity cannot prove this. |
| E25-AC05 | GAP | LightField.heroAt selects one light; no 40-light hysteresis/crossfade test. |
| E25-AC06 | PASS (existing evidence) | tests/visual/e25-lighting.spec.ts; hero-shadow.json and hero-shadow.png report tinted shadow; rerun pending. |
| E25-AC07 | GAP | Placeholder only; weather blackout is not generator startup flicker. |
| E25-AC08 | GAP | Placeholder only; breakable lamp and darkness sight penalty absent. |
| E25-AC09 | GAP | Placeholder only; depth-faded cones absent. |
| E25-AC10 | GAP | E28 supplies wet streaks; reflection-lab and SSR silhouette evidence absent. SSR is staged to release extras (04 §6). |
| E25-AC11 | GAP | Placeholder only; camera-dependent material-class/env proof absent. |
| E25-AC12 | GAP | Placeholder only; interior mapping proof absent. |
| E25-AC13 | PASS (existing evidence) | tests/visual/e25-lighting.spec.ts; night-readability.json and masks; rerun pending. |
| E25-AC14 | PARTIAL | tests/perf/e25-lighting.spec.ts covers L1 and night-street, not light-lab. |
| E25-AC15 | GAP | Placeholder only; complete day/night asset preview evidence absent. |
| E25-AC16 | GAP / L6 DEFERRED | Existing review fails geometry occlusion, beams and reflections. L6 shelter-fails deferred to E24 per task; all other spots remain required. |

## Validation

Pending. Epic remains in-progress until all non-deferred criteria have evidence.

## Closure boundary

The existing `e25-deferred.spec.ts` placeholders are not passing tests. Core gaps (03, 05, 07, 08, 09, 11, 12, 15 and most of 16) cannot be relabelled as deferred merely to close the epic. Only manual WebGPU proof and the expressly staged SSR/GTAO/planar work have existing written deferral grounds; the L6 checklist spot belongs to E24 per this task. Status remains `in-progress` while those other gaps are open.

All eight lighting presets have reproducible Scene Lab scenes in `scene-lab/preset-*/scene.json`; their contact sheets and review are recorded below. These isolated preset scenes are mood/readability evidence, not substitutes for the missing trailer, reflection, interior and production photo-spot criteria.

## Scene Lab preset review (headless WebGL2, inspected 2026-10-10)

Each scene uses the same asphalt, street lamp, bench, courier and infected at a fixed game angle. Final framing is 1.5×; all actors and the bench remain inside the frame at the sampled ticks. All eight scene runners passed console-error checks.

| Preset | Inspected sheet | Observation |
| --- | --- | --- |
| L1 | scene-lab/preset-L1/sheet.jpg | Warm morning asphalt, modest purple shadows, clear courier and infected silhouettes. |
| L2 | scene-lab/preset-L2/sheet.jpg | Neutral bright midday, shortest shadows; bench and clothing colors remain distinct. |
| L3 | scene-lab/preset-L3/sheet.jpg | Warm late afternoon; lamp/bench shadows lengthen rightward with a purple tint. |
| L4 | scene-lab/preset-L4/sheet.jpg | Long directional shadows and subdued warm light; brighter, cleaner air than sunset. |
| golden | scene-lab/preset-golden/sheet.jpg | Warmest daylight pool; very long tinted lamp shadow, readable moving infected. |
| L5 | scene-lab/preset-L5/sheet.jpg | Red dusk ground with violet shadows; practical lamp now visibly warms its pool. |
| L6 | scene-lab/preset-L6/sheet.jpg | Cool blue moonlight and orange practical contrast; this is a preset fixture, not L6 mission evidence. |
| night | scene-lab/preset-night/sheet.jpg | Darkest blue environment; warm lamp pool and player fill remain clear, infected eyes stand out. |

Checklist G is **not a PASS**: these fixtures do not demonstrate fence occlusion, cones, SSR, parallax windows, or the required production/reference photo-spot matches. Existing AC06/13 quantitative production checks passed in the first fresh browser run.

## Performance before / after

Both runs used headless Chrome with Metal WebGL2, one worker and the quiet-run reservation of both browser slots. Phone profiles use the existing 4× CPU throttle and existing DPR. No budget or effect was removed. Before: 10/10 existing L1–L5 checks. The table below is the earlier E27-only implementation run (14/14), not the final E25-core source. Final E25-core measurements are pending; a subsequent intermediate run failed L3 phone fallback (66.6 ms, then 58.5 ms on repeat, unchanged limit 50 ms) and is retained in closure/perf-failed. Raw evidence: E25 `closure/perf-before/` and `closure/perf-after/`; conditions in `closure/perf-conditions.jsonl (before) and closure/perf-final-conditions.jsonl (final after)`. High asserts p95 ≤14 ms; phone uses its existing p50 ≥30 fps proxy, with p95 also reported.

| Level / spot | Tier | Before p50 / p95 ms | After p50 / p95 ms | Result |
| --- | --- | --- | --- | --- |
| L2 peak | high | 7.0 / 9.2 | 6.6 / 8.9 | PASS |
| L2 peak | low | 25.7 / 31.3 | 21.3 / 27.1 | PASS |
| L3 attack | high | 4.9 / 7.3 | 4.9 / 7.4 | PASS |
| L3 boulevard | high | 5.0 / 8.0 | 5.0 / 8.1 | PASS |
| L3 street | high | 6.2 / 8.7 | 6.1 / 8.8 | PASS |
| L3 attack | low | 17.0 / 34.0 | 17.5 / 34.4 | PASS |
| L3 boulevard | low | 16.5 / 34.1 | 16.8 / 33.8 | PASS |
| L3 street | low | 18.7 / 34.3 | 22.6 / 31.5 | PASS |
| L4 war | high | 5.4 / 7.3 | 5.6 / 7.5 | PASS |
| L4 collapse | high | 8.1 / 9.8 | 7.1 / 9.2 | PASS |
| L4 war | low | 19.0 / 34.4 | 15.6 / 32.4 | PASS |
| L4 collapse | low | 20.5 / 33.6 | 20.2 / 34.5 | PASS |
| L5 group walk | high | 5.1 / 7.7 | 5.2 / 7.8 | PASS |
| L5 group walk | low | 13.5 / 19.3 | 13.7 / 19.1 | PASS |

L1 is the existing structural photo-spot gate; it does not assert frame percentiles.

| L1 | Before max draws / triangles | After max draws / triangles | Result |
| --- | --- | --- | --- |
| high | 112 / 802,451 | 112 / 802,451 | PASS |
| low | 90 / 321,149 | 90 / 321,149 | PASS |

Earlier E27-only full unit/sim gate: **911 passed, 0 failed**, 221 reported suites green; 9 pending entries are the explicitly excluded long batteries. Filter: `^(?!.*(?:20 seeds|20-seed|battery|T-E05-encounter|T-E08-11|T-E19-06))`. The three extra exact IDs identify unlabelled long encounter/patrol/20-seed spread batteries from their source. No acceptance tests were weakened or newly skipped. Evidence: E25 `closure/unit-sim-final.json` and `.log`; remote runner exited 0. Latest typecheck and lint passed. Main merged again: already up to date at `baf1fb5a`. Final browser/performance gate is queued.

## Level-suite investigation

The first final level run returned **22 passed, 2 failed** (L1 unassisted bicycle travel and L2 unassisted escape). A targeted L1 repeat returned one pass and one failure; no assertion was weakened. Detached unchanged main reproduced the **same L2 escape failure at exactly the same transform** (-46.4671, -37.9352), with 3/4 targeted repetitions passing. Evidence: E27 `closure/main-baseline/results.json`, `L2-error-context.md`, `closure/main-levels.log`, `levels-final.log`, `l1-diagnostic.log`. The temporary detached worktree was removed.

L2's helper restored the follow camera before InputSystem consumed the queued screen click. It now steps one real sim tick under the projecting camera, matching the existing L1/L3 helper; the destination and gameplay assertions remain unchanged. The full production level rerun passed **24/24** (14.2 minutes), including both previously failing routes; `E27/closure/levels-final.json` and `levels-rerun.log`. L1's extra lastPick diagnostic is retained to expose future failures.

## Current integration gate (2026-10-10)

Implementation is committed through `78e39cbf` (production source `100207ee`), following the merge of main `98e9aa79`. Closure remains **in progress** until the fresh combined gate is green.

- Full remote unit/simulation suite: **962 passed, 0 failed**, three long batteries excluded. Raw results: E25 `closure/unit-sim-final.json` and `.log`.
- Typecheck, lint and build passed during the current E25 verification; selected remote E25 suite: **28 passed**. Browser stages are queued.
- Fresh full level suite: **29 passed, 2 failed**, no skips. Oak repeats the same travel stall; L6 completes with 27 rescued and no deaths but fails its straggler-rejoined assertion. Evidence and the short exact-position simulation probe: E27 `closure/levels-oak-repeat/README.md`.
- Fresh Scene Lab captures and final combined L1–L5 performance checks remain pending. Earlier passing captures/performance are historical evidence, not the final gate.

No budgets, level arrival tolerances, mission data or assertions were weakened. E25/E27 status remains `in-progress`.
