# Merge batch 11

Integration branch `lane/merge-batch11`, starting at main `c31833b25`. Merged in order: `lane/night-bodies-eyes` (50f614782), `lane/seethrough-silhouette` (3f325e17b), `lane/vfx-stunning-3` (d80f5ef0d), `lane/credits-complete` (cf8512b38). All merges were clean, including the shared GameView changes. No deployment or merge into main. Integration fix commit: `89c036008`.

## Integration fix

Native E18 counters exposed a new L5 low-tier regression: female/male triangle totals rose from main's **486,647 / 491,303** to **606,976 / 611,632**, beyond the unchanged **500,000** budget. The surface guard restored entire authored rig parts whenever the first simplification lost more than 15% of their area.

The final simplifier preserves folds and searches a bounded set of retained triangle counts before falling back to the authored part. Low infected bakes target 10% instead of 20%; their position-error limit, locked eye vertices and **85% per-part surface retention** remain unchanged. Civilian simplification and healthy-animal target ratios retain their existing behavior. Final female/male L5 counters are **494,218 / 498,874**, both passing. High-tier ratios and all E18 limits remain unchanged.

The existing real-asset test now also requires at least 30% triangle reduction for every regular low-tier infected model while preserving its surface and eye checks. Added `tests/scenes/catalog/e18-infected-surface-lod.json`: 100 infected, seven regular models, game camera, night lighting, both tiers and all zooms. The existing `e18-*` matrix filter includes it automatically. No specs or protected assets were edited.

## Validation

| Check | Result | Evidence |
| --- | --- | --- |
| Remote unit + levels + sim after pair 1 | 3,155 passed, 7 timing failures, 11 skipped; 508 files | [Full log](pair1-remote.log) |
| Remote unit + levels + sim after pair 2 | **3,164 passed, 9 skipped; 505 passing files, 3 skipped** | [Full log](pair2-remote.log) |
| Final focused geometry tests | **21 passed** on Hetzner, four workers | [Log](final-geometry-unit.log) |
| Final L5 low counters | **2 passed** | [Log](final-l5-counters.log) |
| Focused area matrix before the integration fix | WebGL2 **156/158**, WebGPU **156/158**; all low cells pass; only convoy high/1 and high/1.5 fail | [WebGL2](focused-webgl2/index.md), [WebGPU](focused-webgpu/index.md) |
| Phone credits at 390×844 | **6/6 WebGL2, 6/6 WebGPU** | [WebGL2](credits-phone-webgl2/index.md), [WebGPU](credits-phone-webgpu/index.md) |
| Initial native E18 batch | **20 passed, 2 L5 counter failures subsequently fixed, 4 predefined skips**; 5.2-minute exclusive batch | [Log](e18-native.log), [admission conditions](e18-conditions.jsonl) |
| Independent selected functional e2e, port 3623 | **108/108 passed**, one worker to share browser capacity, 25.0 minutes | [Log](gate-functional.log) |
| Final geometry matrices | **18/18 WebGL2 and 18/18 WebGPU** | [WebGL2](final-webgl2/index.md), [WebGPU](final-webgpu/index.md) |
| Final native E18 counters / frame times | **10 passed, 1 predefined manual skip**; high horde p95 **6.3 ms**, throttled low **12.5 ms**; 1.5-minute exclusive batch | [Log](final-e18-native.log), [conditions](final-e18-conditions.jsonl), [measurements](e18-final/) |
| Supplied browser gate, ports 3621/3622 | Typecheck/lint/build and **16/16 smoke** pass; full WebGPU matrix **1,261/1,266**, all cells measured in **80 min 33 s**; exits 1 on five reds | [Log](gate-browser.log), [full matrix](full-matrix/index.md), [all row records](full-matrix/index.json) |
| Final L1 grade/look stage, run separately after matrix exit | Exit **0**, six existing `fixme` skips for retired L1 flow; current L1 playthrough passed in the 108-case functional battery | [Log](gate-l1-native.log), [conditions](gate-l1-conditions.jsonl) |

All full Node sweeps ran on Hetzner with at most four workers. Timing retries used `tools/remote/timing-isolated.sh` and one worker. Browser work stayed headless on the Mac, Metal for WebGL2, unique ports, through the browser locks. Native timing used quiet-run; the first reservation lasted 5.2 minutes and was released before the intervening ordinary browser batches. No local Vitest sweeps. The final exclusive reservation lasted 1.5 minutes, after both final ordinary matrix batches. The new reduction assertion fails five models against the original whole-part fallback ([negative check](regression-negative.log)).

## Final native E18 measurements

| Scenario | Draws / limit | Triangles / limit | Frame p95 / limit |
| --- | --- | --- | --- |
| High horde, 200 infected + 40 civilians | 71 / 600 | 571,113 / 1,500,000 | 6.3 / 16.7 ms |
| Low horde, 100 infected + 40 civilians, phone viewport, 4× CPU throttle | 69 / 300 | 127,759 / 500,000 | 12.5 / 33.3 ms |

The separate native desktop reference test records **5.8 ms** p95. All seven fixed-camera counters pass, including L5 female **494,218** and male **498,874** triangles. Full measurements are in [e18-final](e18-final/).

## Red table

“Red on main” uses starting main `c31833b25`, before any repair. The exact new convoy fixture was copied into the comparison checkout, with its original gates. Timing host differences are recorded rather than hidden. For APC coverage, main was rebuilt with only the new measurement hooks, catalog runner and identical fixture; its normal rendering behavior remains baseline. The exact [instrumentation patch](main-measurement-instrumentation.patch) is retained for reproduction.

| Red | Integration observation | Red on main? | Comparison / disposition |
| --- | --- | --- | --- |
| Convoy WebGL2 high, zoom 1.5 | 3,200 outside pixels, limit 0 | **Yes**: 7,800 | [Main matrix](main-convoy-webgl2/index.md); inherited; unchanged gate |
| Convoy WebGL2 high, zoom 1 | 407 outside pixels | **Yes**: 995 | Same comparison; inherited |
| Convoy WebGPU high, zoom 1.5 | 3,204 outside pixels | **Yes**: 7,807 | [Main matrix](main-convoy-webgpu/index.md); inherited |
| Convoy WebGPU high, zoom 1 | 412 outside pixels | **Yes**: 991 | Same comparison; inherited |
| APC/sedan contact WebGPU low, zoom 0.5 | retained silhouette 2/7 = 28.57%, minimum 30% | **Yes**: 0% | [Starting-main matrix](main-apc-webgpu/index.md); main fails all six cells with the identical fixture and measurement hooks; inherited; unchanged gate |
| Zoo routines high, zoom 1.5 | clipping 2, limit 0 | **Yes**: 2 | [Starting-main matrix](main-zoo-webgpu/index.md); inherited; unchanged gate |
| Zoo routines low, zoom 1.5 | clipping 2, limit 0 | **Yes**: 2 | [Starting-main matrix](main-zoo-low-webgpu/index.md); inherited; unchanged gate |
| L5 low female triangles | 606,976 originally; **494,218 final** | **No**: 486,647 | Integration fix above; unchanged 500k limit |
| L5 low male triangles | 611,632 originally; **498,874 final** | **No**: 491,303 | Integration fix above |
| Residency 200 p95 | 4.260 ms shared; all 11 tests pass isolated | **No** in isolated comparison | [Isolated](pair1-isolated.log), [main](main-timing-comparison.log); timing noise under job rule |
| L10 assault high p95 | 4.893 ms shared; all 5 tests pass isolated | **No** in isolated comparison | [Isolated](pair1-assault-isolated.log), [main](main-timing-comparison.log); timing noise |
| Alpha support 200 p95 | 4.535 ms shared; isolated pass | **No** | [Isolated batch](pair1-performance-isolated.log), [main](main-performance-comparison.log); timing noise |
| Alpha physical 200 p95 | 4.306 ms shared; isolated pass | **No** | Same isolated batch; [same-host main](main-same-runner-timing.log); timing noise |
| Zoo S1 200 p95 | 5.888 ms shared, 4.134 ms isolated on 2.28.24.66 | **Yes**: 5.620 ms isolated on same host | [Same-host main](main-same-runner-timing.log); both pass on 94.130.181.173; inherited host-dependent budget failure |
| Zoo S2 200 p95 | 4.200 ms shared, 5.745 ms isolated on 2.28.24.66 | **Yes**: 6.819 ms isolated on same host | Same comparison; inherited host-dependent budget failure |
| Alpha mixed 200 p95 | 5.213 ms shared; isolated 4.669 / 4.164 ms on 2.28.24.66 | **No** in two isolated same-host main runs | [Integration retry](alpha-same-runner-final.log), [main](main-same-runner-alpha.log), [repeat](main-alpha-repeat.log). Unresolved timing discrepancy on that host; final full suite passes on 94.130.181.173. Simulation/core/physics sources are identical to main; no speculative sim fix. |

The main convoy also fails low/zoom 1.5 on both backends (14 pixels); integration passes that cell. The convoy final-frame diagnostic places the outside difference at the screen edge; canvas-only pixels also differ, so DOM HUD changes are not its sole cause. [Diagnostic](convoy-diagnostic/result.json), [difference image](convoy-diagnostic/canvas-diff.png). These inherited reds remain under the explicit “red on main = report, don't fix here” rule.

## Visual review and limits

[Opened sheets and written descriptions](visual-review.md) include low-tier WebGPU seethrough at zoom 0.5, night infected, vehicle crash at zoom 0.5, and phone-width credits. Both backend/tier matrices also include zoom 1 and 1.5.

The final exclusive E18 batch passes all seven counter cases and native desktop/horde frame time. The initial exclusive batch also passes both five-load memory checks, all eight courier/tier/backend initial-download combinations and both emulated WebGL device checks. Physical iOS/Android recordings and predefined manual WebGPU performance cases remain unmeasured/skipped. Animated heat-haze quality cannot be established from still sheets. The full 1,266-cell deploy matrix is measured, including high/low and zoom 1.5/1/0.5. The orchestrator explicitly waived the 30-minute admission limit for this gate; the run waited for two slots and completed with two headless browsers. Every full-matrix contact sheet and every row’s gate results are retained in [full-matrix](full-matrix/index.md); detailed per-frame metrics are also retained for failures and the geometry/convoy comparisons. The supplied gate exits 1 on five matrix reds, so its exact 108-case functional battery and final L1 grade/look command were completed separately. This branch is not a green deploy gate. All five matrix reds reproduce on starting main and are recorded in the red table. The Alpha mixed 200 isolated timing discrepancy on runner 2.28.24.66 also remains recorded; it was not reproduced on main in two same-host runs, while the second full suite passes on runner 94.130.181.173.

## Outcome

All four lanes are merged on the integration branch and the new E18 L5 triangle regression is repaired in `89c036008`. Final build, typecheck, lint, the second full remote suite, all 108 selected functional e2e cases, 16 smoke cases, focused backend/phone checks and final native E18 budgets pass. The full deploy matrix is **fully measured: 1,261/1,266 pass**. Its five remaining reds are all reproduced on starting main, so they are reported without changing their tests or budgets. The supplied gate remains **red**, and the slow-runner Alpha isolated timing discrepancy remains unresolved. No deployment or merge into main was performed.
