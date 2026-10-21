# L7 frame budgets — E29-AC19/20

**AC19 resource/simulation caps pass in the measured matrix. AC20 remains open.** The literal frame and maximum gates below include every failing repeat. E29 is not certified green.

## Scope and baseline

Base `33181db1a` merges the requested `lane/heap-budgets` and `lane/hitches2`. Original-build measurements use the independently preserved production build; no test, spec, threshold, measurement window, population, corpse lifetime, particle count, effect quality, LOD policy or draw distance was changed. Corpses remain for the level. No push, deployment or merge into main was performed.

The latest complete L7 matrix is native stage **10**; final transitions are stage **10**, lifecycle stage **10**, and final captures stage **10**. Build/source receipts identify each revision. All browser work is headless, one local browser at a time, private ports 3971/3972. Timing owns the existing quiet lock, with reservations ≤20 minutes and admission ≤30 minutes. Phone runs use the unchanged 4× CPU throttle, touch profile, 390×844/DPR1; desktop uses 1600×900. WebGL uses ANGLE Metal; WebGPU selection and native adapter are checked.

## Profile and changes

Diagnostic `loadProfile=2`, renderer.info, CPU split/CDP sampling and separate paused GPU timestamp draws identify recurring CPU work. Original low horde view p95 was 15.6 ms WebGL / 16.5 ms WebGPU; render submission 7.6/8.2 ms and NPCs about 3.8 ms. GPU draws were approximately 3.3/6.3 ms. Combat produced zero new node builds. Rocket refill CPU bursts reached 32.1 ms; the first candidate reduced the observed diagnostic maximum to 26 ms. These instrumented profiles are diagnostics, not acceptance timings. [Profile receipt](evidence/profile-before-summary.json).

- Reuse exact body part matrices for world/projected bounds; health bars compute only the projected Y/W extrema they consume.
- Hoist pose interpolation bounds, copy integer pose rows natively, and skip constant homogeneous divisions for affine paw matrices.
- Reuse spawn model counters and up to eight exact blocking-body witnesses per synchronous admission search. A position is accepted only after the full registry query.
- Upload active prefixes of existing bar/shadow/light buffers and keep immutable rig indices in a static uniform group. Capacities, counts and surfaces remain.
- Use paced asset preparation, cooperative node builds, smaller warmup groups and exact paced crowd bakes during L8 loading. Prepare default L8 layout/navigation behind L7’s initial card, consume it once, and retain the normal path for other seeds/layouts.
- Preserve the previous frame and the original initialization updates behind the loading card. A capped canvas submission and an animated status indicator keep loading presentation active; gameplay frames are unchanged.

## AC19 — literal resource and simulation caps

| Tier | Draws ≤600/300 | Triangles ≤1.5M/500k | Sim p95 ≤4/6 ms | Collected heap ≤400/250 MB | Infected ≤200/100 |
| --- | ---: | ---: | ---: | ---: | ---: |
| high | 231 → 230 | 965,941 → 960,880 | 2.1 → 2.1 | 97.38 → 97.80 | 200 → 200 |
| low | 165 → 165 | 405,447 → 391,672 | 5.0 → 4.5 | 86.15 → 86.89 | 100 → 100 |

Every measured AC19 cap, including the recorded effect/light/prop maxima, passes. Heap uses collected CDP `usedSize` / 1,000,000 bytes, rather than raw/uncollected browser memory. Full compact rows: [before](evidence/native-before.json), [after](evidence/final10-budgets.json).

## AC20 — frame and blast maxima

Milliseconds. Gates use the unrounded readings; a rounded display value is never used to change a pass/fail. The existing fixtures enforce the 50 ms maximum on phone runs too.

| Backend / workload / tier | Frame p95 before → after | Limit | After frame gate | Maximum before → after | After ≤50 ms |
| --- | ---: | ---: | --- | ---: | --- |
| webgpu / district / high | 12.1 → 12.1 | 16.7 | PASS | 17.9 → 18.7 | PASS |
| webgl / district / high | 12.2 → 11.8 | 16.7 | PASS | 27.5 → 29.9 | PASS |
| webgpu / district / low | 33.0 → 33.8 | 33.3 | **FAIL** | 37.2 → 37.0 | PASS |
| webgl / district / low | 34.0 → 33.3 | 33.3 | PASS | 37.3 → 37.4 | PASS |
| webgpu / encounters / high | 10.8 → 10.7 | 16.7 | PASS | 24.8 → 24.7 | PASS |
| webgl / encounters / high | 11.4 → 10.9 | 16.7 | PASS | 25.7 → 24.0 | PASS |
| webgpu / encounters / low | 33.1 → 34.2 | 33.3 | **FAIL** | 35.9 → 44.8 | PASS |
| webgl / encounters / low | 33.7 → 33.4 | 33.3 | **FAIL** | 47.9 → 36.1 | PASS |
| webgpu / rocket / high | 6.8 → 6.4 | 16.7 | PASS | 20.8 → 19.5 | PASS |
| webgl / rocket / high | 8.2 → 7.7 | 16.7 | PASS | 24.6 → 24.9 | PASS |
| webgpu / rocket / low | 17.9 → 16.7 | 33.3 | PASS | 62.4 → 48.9 | PASS |
| webgl / rocket / low | 31.9 → 20.5 | 33.3 | PASS | 65.8 → 63.0 | **FAIL** |

## AC20 — complete handover window

The measured window includes boarding, departure, the loading card and fully loaded L8. No loading frames are excluded. “Before” is the complete pre-handover-repair sweep (the initial render/admission candidate), rather than an invented original-build transition baseline.

| Backend / tier / phase | Maximum before → after (ms) | ≤50 ms | Final state |
| --- | ---: | --- | --- |
| webgl2 / high / checkpoint | 37.2 → 37.5 | PASS | L7/corridor; loading=False |
| webgl2 / high / boarding | 2739.6 → 171.2 | **FAIL** | L8/None; loading=False |
| webgl2 / low / checkpoint | 48.3 → 48.2 | PASS | L7/corridor; loading=False |
| webgl2 / low / boarding | 565.5 → 252.0 | **FAIL** | L8/None; loading=False |
| webgpu / high / checkpoint | 34.4 → 35.9 | PASS | L7/corridor; loading=False |
| webgpu / high / boarding | 2591.8 → 116.7 | **FAIL** | L8/None; loading=False |
| webgpu / low / checkpoint | 50.2 → 35.8 | PASS | L7/corridor; loading=False |
| webgpu / low / boarding | 10177.4 → 251.0 | **FAIL** | L8/None; loading=False |

[Before transitions](evidence/transitions-before.json), [final transitions](evidence/final10-transitions.json). High pre-repair peaks were 2,739.6/2,591.8 ms WebGL/WebGPU. The first cooperative iteration reduced them to 128.3/110.4 ms; later results above remain authoritative.

## AC20 — five-load retention and settings

Each case loads L7→L1→L7→L1→L7, collects JS heap, and compares last L7 with first L7. The existing resource audit uses 960×600 on both tiers; it is a retention check, not phone frame certification.

| Backend / tier | Heap retained, before → after | Geometry ratio, before → after | Texture ratio, before → after | Settings / ≤110% |
| --- | ---: | ---: | ---: | --- |
| webgl-high | 95.6% → 95.7% | 97.7% → 97.7% | 101.5% → 101.5% | PASS |
| webgl-low | 95.1% → 95.1% | 97.7% → 97.7% | 101.7% → 101.7% | PASS |
| webgpu-high | 95.8% → 95.9% | 97.7% → 97.7% | 101.5% → 101.5% | PASS |
| webgpu-low | 95.5% → 95.6% | 97.7% → 97.7% | 101.7% → 101.7% | PASS |

Flash reduction, camera shake and gore settings are checked on every load. [Original-build lifecycle](evidence/lifecycle-before.json), [final lifecycle](evidence/final10-lifecycle.json).

## Visual and numerical equivalence

11/12 L7 horde pairs and 4/4 L8 gameplay pairs are exactly RGB-identical. Across all 24 L7 horde/rocket pairs, 17/24 are exact. The low-WebGL settled horde frame differs at 1,366 pixels (0.415%, maximum channel delta 84); six synthetic rocket frames differ at 1–33 pixels (maximum channel delta 46). All entity/health/transform/corpse censuses match. Every RGB difference is counted without masks, alignment or tolerance. Unchanged-build controls show some small rocket-edge variation, but the final horde discrepancy has not been explained. The strict no-visual-change requirement is therefore not certified.

[L7 pixel counts](evidence/pixels-final.json), [L8 pixel counts](evidence/handover-pixels-final.json), [baseline repeat](evidence/baseline-repeat-pixels.json). Earlier candidate comparison sheets (not final-stage equality evidence): [GL high](evidence/horde-webgl2-high.jpg), [GL low](evidence/horde-webgl2-low.jpg), [WebGPU high](evidence/horde-webgpu-high.jpg), [WebGPU low](evidence/horde-webgpu-low.jpg). Full frames remain local.

Independent equivalence checks pass: 57,600 pose components; 9,600 bounds coordinates; 518,400 corgi matrix components; 1,000 projected-top poses; 518 spawn / 1,120 search / 14 complete admission snapshots with 418 persistent corpses; 22 prepared/fresh L8 snapshots over 600 ticks per tier; and 766,080 paced/synchronous bake components plus every geometry attribute. The bake calculation body is byte-identical after removing yield points. [Admission](evidence/admission-equivalence.json), [prepared navigation](evidence/handover-equivalence.json), [bake](evidence/bake-equivalence.json), [bake body](evidence/bake-body-equivalence.json).

An intermediate preserved-frame implementation changed the courier foot pose by skipping one initialization update. That was corrected, and the final L8 exact comparisons above include the correction. An uncapped loading-submission experiment was interrupted after saturating the GPU; it supplies no completed acceptance result.

## Validation and reproduction

- Typecheck, lint and production build: pass on the final implementation.
- Latest complete remote unit/level run: **2,155 passed / 11 skipped**, 394 files passed / 3 skipped. A repeated run had 2,157 passed / 9 skipped (two existing audio cases vary by runner availability); no skip or test edits. [Latest receipt](evidence/unit-final7.json).
- Final render/asset suite: **1,166 passed / 160 files**. [Receipt](evidence/render-final9.json).
- Full E29 verification completed with **18 browser tests passed / 13 failed**; selected simulation tests were **112 passed / 0 failed**. Browser failures include seven L7 timeouts, focus/resume advancing only 28 ticks against >60, and five WebGPU buffer/device errors. This run began before the final paced-bake/loading-style changes; no final full functional rerun completed. [Verification receipt and failure details](evidence/verification.json). Native budget failures above remain open independently of this functional run.

Run original district/encounter/rocket fixtures through `sh tools/perf/quiet-run.sh sh tools/e2e-lock.sh`, ports 3971/3972, one worker. `L7_PERF_BACKEND=webgpu` selects the existing district/encounter backend; `tools/perf/l7-rocket-backend.ts` supplies the missing WebGPU rocket companion with the byte-identical evaluation body. [Measurement receipt](evidence/measurement-receipt.json). `tools/perf/l7-transition-audit.ts` retains its original setup/window/limits and adds backend/tier selection and adapter verification. `HEAP_AUDIT_LIFECYCLE=1 npx tsx tools/perf/heap-audit.ts` runs the unchanged resource audit.

Raw profiles, complete frame records and Playwright reports stay in ignored local `test-results/l7-perf/`. Only compact summaries/receipts and comparison sheets are committed; report JSON remains below 1 MB.

## Remaining work

Close the failing low-tier frame/maximum cells, remaining handover maxima, and unexplained final pixel difference. Re-run the complete quiet matrix and resolve the broader E29 verification failures before closing AC20/E29. Population, persistence and visual quality constraints still apply.
