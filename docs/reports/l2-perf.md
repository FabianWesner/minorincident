# L2 performance

Lane `lane/l2-perf`, base main `131f4835`. Both unchanged native T-E20-20 cases pass three consecutive runs with at least 10% headroom on every maximum gate. The final full unit suite, typecheck, lint, build, L2 e2e and WebGL2/WebGPU crowd smoke checks are green. The additional remote E20 simulation selection also passes; its snapshot scope is stated below. No deployment, push, budget, throttle, population or camera-path changes.

## Native acceptance results

Command: `E2E_PORT=3387 sh tools/e2e-lock.sh npx tsx tools/perf/l2-headroom.ts`. This invokes the original `tests/perf/l2-budgets.spec.ts` unchanged, one native headless Chrome worker at a time, and checks additional headroom after each pair. All six native cases and all additional checks pass; no failed pair interrupts this series.

| Run / tier | Native peak metric | Draw calls | Triangles | Reveal max | Gate max |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 desktop high | p95 8.7 ms | 253 | 1,271,865 | 31.4 ms | 13.6 ms |
| 1 phone low, 4× CPU | p50 22.8 ms | 251 | 404,230 | 37.3 ms | 37.6 ms |
| 2 desktop high | p95 8.6 ms | 253 | 1,271,865 | 39.9 ms | 14.3 ms |
| 2 phone low, 4× CPU | p50 22.7 ms | 250 | 411,296 | 37.3 ms | 37.6 ms |
| 3 desktop high | p95 8.5 ms | 253 | 1,271,865 | 33.3 ms | 14.0 ms |
| 3 phone low, 4× CPU | p50 22.3 ms | 250 | 411,296 | 37.2 ms | 37.5 ms |

Worst original-limit headroom: desktop frame 37.9%, desktop triangles 15.2%, desktop draws 57.8%; phone frame 31.6%, phone triangles 17.7%, phone draws 16.3%; reveal 20.2%, gate close 24.8%. Every desktop run has 30 infected, 43 living civilians and six firefighters at the measured camera; phone runs have 30 infected, 29–30 living civilians and six firefighters. Gameplay continues during the measurement, accounting for small count/triangle variation. Population configuration is untouched.

The worst phone submission is 38,704 triangles below the requested 450,000 target. Adding the truck lane's estimated 19,000 triangles would reach approximately 430,296, leaving room; this estimate does not replace measuring the merged build. Evidence: `test-results/epics/E20/perf/headroom.json`, `run-{1,2,3}/l2-{high,low}.json`, screenshots and each pair's `playwright.json`.

## Baseline and profile

Native headless Chrome, ANGLE/Metal, one worker under `tools/e2e-lock.sh`. Seed 2, high desktop and low Pixel 7 with the original 4× CDP CPU throttle. This newer main has different counts from the supplied `17fc6b7d` evidence, so the table uses a fresh local baseline.

| Measurement | Before | Required with headroom |
| --- | ---: | ---: |
| Desktop frame p95 | 13.3 ms | ≤ 12.6 ms |
| Desktop triangles | 1,515,957 | ≤ 1,350,000 |
| Phone triangles | 558,615 | ≤ 450,000 |
| Phone frame p50 | 33.1 ms | ≤ 30 ms |
| Desktop reveal / gate maximum | 51.9 / 18.1 ms | ≤ 45 / 45 ms |
| Phone reveal / gate maximum | 52 / 54 ms | ≤ 45 / 45 ms |

Baseline native result: both cases fail their original triangle limits. The native gate is unchanged. Baseline evidence is `test-results/epics/E20/perf/before-l2-*.json` and `before-l2-collapse-*.png`. A separate diagnostic repeats the native setup and samples the peak with CDP's CPU profiler; its timing includes sampling overhead and is not used as gate evidence. Profiles are under `perf/profile/`.

The desktop CPU sample attributes ~924 ms of the 10 s peak to `updateMatrixWorld`, ~889 ms to `bufferSubData`, ~480 ms to matrix multiplication and ~369 ms to `texSubImage2D`. The phone sample identifies navigation visibility (~512 ms), world-matrix updates (~656 ms), spatial queries (~330 ms) and render submission. These are sampled CPU time, not GPU timer measurements.

The corgi was loaded at LOD0 on both tiers: 58,368 triangles versus 6,900 for its authored LOD1. The crowd pose palette did not identify its changed rows. Its callers supplied the entire reserved mutable pose area as an upload range on every draw, including hundreds of unused slots. Fine pose-row ranges were also overwritten by those callers in the first pilot; both overrides are removed in the final patch.

At the same collapse camera, category triangle counts show where the reduction comes from:

| Category | Desktop triangles before → after | Phone triangles before → after | Desktop / phone draws |
| --- | ---: | ---: | ---: |
| Crowd view | 320,862 → 198,816 | 134,062 → 82,613 | 7 / 9 |
| Other view (includes dog, dressing, vehicles) | 535,540 → 535,540 | 206,372 → 154,904 | 129 / 150 |
| Shadow / other-camera passes | 546,225 → 424,179 | 171,133 → 119,665 | 94 / 85 |
| Buildings | 87,298 → 87,298 | 45,748 → 45,748 | 11 / 5 |
| Props | 26,032 → 26,032 | 1,300 → 1,300 | 12 / 2 |

The comparison uses final run 1, whose measured living counts match the baseline. Category draw counts are unchanged. The profile labels passes using a different camera as `shadows`, so a few bloom/postprocessing triangles are included; these are submission counts, not isolated GPU pass timings. Prop/building phone LOD selection and existing instancing are retained. The dog is out of the desktop collapse view. Shadow range, resolution, casters, materials and crowd LOD distances are unchanged; fewer figure indices reduce both view and shadow work. Total draw calls at this camera remain 253 desktop / 251 phone.

## Changes

- Mark mutable pose rows with `Texture.addUpdateRange`; immutable baked clip rows stay resident. Remove both caller overrides and merge adjacent/overlapping dirty rows before upload on both backends. Existing backend support still initializes the entire texture on first use or recreated storage. Regressions check actual row offsets, corrected pose bytes, immutable clip contents and merged upload bytes.
- Freeze local matrices for baked static layout nodes and the identity scene/district roots. Moving views, door leaves and pushed-prop instance matrices keep their normal owners.
- Use the corgi's authored LOD1. Crowd figures keep the same LOD bands, vertices, joints, swatches, eye vertices and infection-mark channels. Reuse the existing per-part index simplifier with a 5 mm close-figure error bound (1 cm for distant figures); triangles never span independently animated parts.
- Navigation visibility still samples every original 20 cm point, checks every original mask/boundary and collects the same walls. Repeated samples within one 4 m bucket reuse its lookup. The exact two slab calculations reuse their bounds and avoid three temporary arrays per wall. A 3,000-case comparison against the original main algorithm covers masks, changing blockers, zero-length/axis-aligned segments and radii from 0 to 1.2 m.
- Extend the opt-in draw profile to name uncategorized meshes. Add L1/L3 comparison coverage with the same native launch, tier viewport/DPR and throttle, plus `tools/perf/l2-headroom.ts` to run both unchanged native cases three times and retain each result.
- Retain nearest-cell memo entries outside a changed blocker's possible search region. Near entries are invalidated using both old and new bounds, including when callers mutate a retained wall. Rebakes still clear every entry. Regression cases compare cached answers with the uncached search across moved/removed blockers, in-place mutations and rebakes.
- Reuse the existing generation-stamp pattern from player route searches in A*. The final phone gate profile attributes approximately 641 ms of sampled self time to A* across the recording. Starting an agent's search cleared three whole-district arrays; now only visited cells are initialized. Search order, heap ties, expansion budgets and route results are unchanged. An exact comparison with the original A* covers 300 searches, bounded retries, blocker changes and generation wrap. This adds one 32-bit stamp per navigation cell.
- A second CDP capture around reveal/gate transitions identified static batching outside the game CPU timers: attribute decoding, colors, transforms and merging dominate the sample. A 16,384-element cooperative chunk could consume a frame before checking the existing 4 ms allowance. Reduce chunks to 1,024 elements; the allowance, output geometry/materials and readiness contracts are unchanged. Tests compare every emitted attribute/index and bounding sphere with the original implementation and check interleaved decode checkpoints.

The original geometry/pose optimization passed both native peak gates, but two attempts retained single reveal/gate frames above the requested headroom (phone gate 52–53 ms). Those failed attempts are retained under `perf/gate-hitch-run/` and `perf/allocation-run/`; they are not counted in the final three-run series. The diagnostic reveal profile (`perf/reveal-profile/`) attributes approximately 557 ms to attribute decoding, 490 ms to batching steps, 393 ms to merging and 278 ms to transforms. This is sampled work over the entire capture, not a single-frame duration. The phone gate diagnostic is under `perf/gate-profile/`.

After smaller batching chunks, phone peak p50 was 22.7 ms and triangles 404,230, but a gate-close burst still reached 50.8 ms. That attempt is retained under `perf/batch-checkpoint-run/`. A fresh phone transition profile (`perf/gate-profile-final/`) exposed the whole-district A* resets above. Diagnostic runs are separate from the consecutive native acceptance series.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=2 --reporter=default --reporter=json --outputFile=test-results/epics/E20/perf/unit-final.json`: **105 files / 372 tests passed**, 43.29 s. The earlier remote full suite passed 370 tests; the final repeat waited over 25 minutes for a remote slot and was moved to the Mac after the performance recordings. It includes the final A* and batching regressions.
- `sh tools/sim-lock.sh npx vitest run tests/sim/ai/navigation.test.ts tests/sim/m1-world.test.ts --maxWorkers=2 --reporter=default --reporter=json --outputFile=test-results/epics/E20/perf/nav-sim.json`: **2 files / 20 tests passed**, 3.37 s, on final A* source.
- `E2E_PORT=3388 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/L2.spec.ts tests/e2e/crowd-drawn.spec.ts --project=chromium --workers=1`: **4/4 passed**, 2.1 min. Includes real-input L2, immediate L3 handover, crowd-drawn WebGL2 and actual WebGPU.
- Full final E20 + smoke browser selection, excluding the separately accepted native perf pair: **29/29 passed**, 4.9 min (Chrome, Pixel 7 portrait/landscape, iPhone portrait/landscape and WebKit; `perf/browser-final.json`). Command: `E2E_PORT=3390 sh tools/e2e-lock.sh npx playwright test --grep '@(?:E20)(?:-AC\d+)?(?=\s|$)|@smoke(?=\s|$)' --grep-invert 'T-E20-20' --workers=1`.
- Remote E20 + smoke simulation selection: **10 files / 28 tests passed**, including **16/16 L2 cases**, 5098.36 s. The tag filter leaves 160 unrelated files / 846 unrelated tests unselected. Command: `sh /Users/wesner/Workspace/minorincident/tools/remote/run.sh "$PWD" --pull test-results/epics/E20/perf/sim.json -- npx vitest run -t '@(?:E20)(?:-AC\d+)?(?=\s|$)|@smoke(?=\s|$)' --maxWorkers=2 --reporter=default --reporter=json --outputFile=test-results/epics/E20/perf/sim.json`. All seven 20-seed batteries are archived in `perf/sim-batteries/`; complete, newbie, no-axe and alarm each complete 20/20 seeds. Observer and first-death trials intentionally stop before level completion. See the snapshot scope below.
- Native acceptance: **6/6 passed** in three consecutive pairs, with all additional headroom checks passed (table above).
- Matched neighbor comparison: **8/8 completed**, same native launch/tier/throttle and one shared browser lock.
- Isolated Scene Lab: **3/3 passed** (high WebGL2, low WebGL2, WebGPU), metrics below.

Validation uses the same selections/stages as `npm run verify -- E20`, split between remote simulation and native Mac browser runs instead of invoking the wrapper. The passing full simulation snapshot includes the batching and blocker-cache changes but precedes the final A* stamp change; the final A* source is covered by exact original-route regression, full unit suite, navigation simulation and real-input L2/campaign tests. This scope is stated explicitly rather than claiming the wrapper or the remote battery ran on a different snapshot.

Two existing test failures needed narrow corrections. L2 immediately loads L3 at completion; the browser test previously read `final.l2` after that state had been replaced. It now retains checkpoint evidence before completion and asserts the existing L3 briefing/carried loadout. T-E20-09's first-death trial previously continued through repeated checkpoint respawns; cherry-pick `fa8a2a1a` of the truck lane's `3f86376b` stops the trial after its first death. All real-input steps, criteria, assertions and test budgets are retained; neither change modifies game runtime.

## L1 / L3 comparison

Same native renderer and 10 s real-clock sample, seed 2, ordinary level-start population. These comparison scenes measure the start camera; they do not claim worst-case coverage for those levels.

| Level / tier | Before triangles | Before frame p50 / p95 |
| --- | ---: | ---: |
| L1 high | 571,296 | 5.4 / 8.0 ms |
| L1 low, 4× CPU | 430,903 | 21.8 / 31.2 ms |
| L3 high | 461,868 | 5.5 / 6.9 ms |
| L3 low, 4× CPU | 349,466 | 13.7 / 16.6 ms |

Evidence: `test-results/epics/E20/perf/neighbors/before-*.json` and matching PNGs.

The first after sample was slower across all scenes, so a fresh main production build and the after build were measured sequentially under one shared browser lock. This keeps timing comparisons close together rather than assuming the earlier machine load remained constant.

| Level / tier | Matched before → after triangles | Matched before → after frame p50 | Matched before → after frame p95 |
| --- | ---: | ---: | ---: |
| L1 high | 571,296 → 454,716 | 5.6 → 5.2 ms | 8.1 → 7.4 ms |
| L1 low, 4× CPU | 430,903 → 319,621 | 20.8 → 18.8 ms | 32.3 → 34.0 ms |
| L3 high | 461,868 → 358,932 | 5.4 → 5.2 ms | 6.7 → 6.4 ms |
| L3 low, 4× CPU | 349,466 → 207,596 | 13.4 → 13.3 ms | 16.0 → 16.1 ms |

Draw counts are identical before/after (234/225 for L1 high/low; 281/293 for L3). All primary native frame metrics improve (desktop p95, phone p50), and geometry decreases. Phone p95 is diagnostic in T-E20-20: L1 increases 1.7 ms in this final pair while sim p95 falls 13.3 → 10.2 ms, render CPU p95 falls 11.8 → 10.9 ms and maximum frame falls 39.4 → 37.1 ms. L3 phone p95 changes 0.1 ms. These secondary tails are reported explicitly; they are not claimed to improve. Matched evidence: `perf/neighbors/matched-{before,after}-*.json/png`.

Three earlier alternating L1 phone pairs after the geometry/pose work (before the last navigation/batching changes) gave before p50/p95 of 20.2/33.4, 20.4/33.0, 23.1/32.3 ms and after 18.3/34.6, 18.5/33.8, 24.2/32.6 ms. Across those pairs, median p50 improves 20.4 → 18.5 ms and median diagnostic p95 rises 33.0 → 33.8 ms. Evidence: `perf/neighbors/tail-{before,after}-{1,2,3}-L1-low.json/png`. The final L1 tail diagnostic reproduces p50 18.8 / p95 34.3 / max 36.8 ms; measured sim p95 is 10.2 ms, update 4.1 ms and render 11.5 ms. Its raw frame samples and CDP profile are retained as `perf/neighbors/tail-diagnostic-L1-low*.json`. It does not justify claiming that this diagnostic tail improves.

## Visual review and limits

Opened the baseline and final run-2 desktop / run-3 phone game-camera captures, plus L1 high and L3 phone before/after and isolated Scene Lab high/low/WebGPU frame 60. Palette, market glass/shelves, truck, foliage, shadows, civilian clothing/limbs, firefighter helmets/reflective gear and red infected eyes remain present. The corgi keeps its proportions, face, tongue and pack, with slightly simpler cheek/forehead polygon contours at close inspection. Civilian helmet/hair contours are slightly simpler; color divisions, accessories and animation ownership remain intact. Phone actor positions vary because the real clock runs. No new missing content, pose corruption or P0/P1 finding in these reviewed views.

Isolated fixture: `tests/scenes/qa-l2-perf-crowd.json`, game camera at zoom 1.1, ten mixed actors over 120 frames. High/low WebGL2 and actual WebGPU each pass console errors=0 and undrawn frames=0. Every actor has 120 drawn/in-view frames and zero missed frames; static/actor clipping and piercing counts are zero. High WebGL2 and WebGPU view-triangle p95=97,082, shadow triangles=81,995; low view-triangle p95=92,482, shadow triangles=51,816. Metrics/captures are retained under `perf/scenes/`. The corgi's Scene Lab LOD label defaults to `lod0`; the actual loader uses authored LOD1, verified by geometry counts. This scene validates the final geometry/pose changes; the later navigation and batching changes alter no geometry.

Scoped vision comparison: `test-results/epics/E20/review.md`. Applicable A/B/D/E/G checklist comparisons pass; this is a before/after performance review, not a new full E20-AC19 vision score or four-view character review. No spec changes.

## Commits

- `2a92ff32` — mutable pose-row uploads, static local matrices, navigation bucket reuse, opt-in profile names.
- `7e00f30f` — civilian index simplification, authored corgi LOD1, actual changed-span uploads and measurement/isolation harnesses.
- `406fadf2` — retain L2 browser evidence before immediate campaign handover.
- `a23b1a3d` — allocation-free navigation slab calculations with exact legacy comparison.
- `fa8a2a1a` — existing truck-lane first-death trial correction (`3f86376b` cherry-pick).
- `90b86a53` — invalidate nearest-cell memo only around changed blocker bounds.
- `39901034` — smaller cooperative batching chunks with byte-equivalence/checkpoint regressions.
- `b33b0540` — generation-stamped A* workspace with exact route/budget regression.

## Remaining qualifications

- L1 phone's secondary, non-gated p95 is higher in the repeated measurements above, despite lower primary frame/CPU/geometry cost. This report does not claim universal improvement of every frame percentile.
- The passing full remote simulation selection precedes the final A* stamp optimization; current-source coverage and the exact-route oracle are described in Validation. Verification stages ran separately; the `verify` wrapper was not invoked.
- The truck lane has not been merged here. Its triangle impact is an estimate; measure the merged main build again.
- Budgets, throttle, camera path, population configuration, visible-content culling, shadows and specs remain unchanged. No dependency changes, push or deployment.
