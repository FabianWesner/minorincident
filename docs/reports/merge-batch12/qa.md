# Merge batch 12 QA

Starting main: `a658575f1`. Integration branch: `lane/merge-batch12`.

| Lane | Requested tip | Merge commit |
| --- | --- | --- |
| Atmosphere 2 | `d41f8c0a3` | `98084c141` |
| Small fixes W6 | `3998df90b` | `95229c372` |

Resolved the small-fixes conflicts by retaining main's infected LOD fold/surface retention and bounded triangle search, measuring simplification error against curled grip positions in both simplifier calls, retaining both lanes' matrix filters, and using the shared indexed-window scanline helper. Added `qa-w6-*`, `atmosphere*` and `night-read-*` to both default matrix commands. No sim/core/physics/level changes, protected reference changes, spec changes, or `staticCollision.ts` churn.

## Explicit pixel and layout proofs

Fresh merged production build. [Initial functional records](functional-proofs/summary.json), [log](evidence/functional-proofs.log), [opened captures and descriptions](visual-review.md). The helper's initial heap metric failed; that measurement defect is explained below. All 36 scene gates and all additional pixel/layout assertions passed.

| Proof | WebGL2 high | WebGL2 low | WebGPU high | WebGPU low |
| --- | --- | --- | --- | --- |
| Zoo clipping at zoom 1.5, limit 0 | 0 | 0 | 0 | 0 |
| Pixel 7 portrait, zoom 0.5 and 1 | Visible, inside viewport, 0 HUD overlaps | Same | Same | Same |
| Pixel 7 landscape, zoom 0.5 and 1 | Visible, inside viewport, 0 HUD overlaps | Same | Same | Same |
| Window shift over 45°→60°, minimum 4 px | 113.869 px | 22.212 px | 113.869 px | 22.212 px |
| Powered/unpowered luminance ratio, minimum 4 | 9.587 | 9.919 | 9.587 | 9.919 |

The phone records cover 16 full HUD captures: two backends × two tiers × two orientations × two zooms. Zoo records also cover zoom 0.5 and 1: all 12 rows have zero clipping. The actual backend and requested/actual quality tier are recorded for every row.

## Readability

[Playwright log](evidence/readability.log), [JSON result](readability/playwright-results.json), [night-street records](readability/). **48 passed, 2 failed** in 6.6 minutes, one headless worker. Includes E25 moods, night-street contrast/eyes on both backends and tiers, L3 contrast, E28 weather moods across both backends and tiers, browser weather checks and foundation smoke.

| Red | Merged | Fresh starting main | Red on main yes/no |
| --- | --- | --- | --- |
| L7 courier contrast high, minimum 3 | 2.031598 | 2.019929 | Yes |
| L7 courier contrast low, minimum 3 | 2.105119 | 2.099763 | Yes |

[Fresh main browser log](evidence/main-l7-readability.log), [main high](baseline/l7/high.json), [main low](baseline/l7/low.json), [merged high](readability/l7-high/rocket.json), [merged low](readability/l7-low/rocket.json). These fresh values differ from the lane's earlier 2.09/2.16 captures but reproduce the same two failures on main. No contrast threshold was changed.

## QA helper corrections

Extended `tools/scenelab/small-fixes-w6.ts` to include Pixel 7 landscape, full-page HUD images, computed visibility and viewport bounds. `W6_TIMING=0` permits pixel/layout checks under the ordinary browser lock; timing stays explicitly unmeasured in those records. Default timing requires quiet-run.

Two inherited measurement defects became observable on the merged run:

1. `performance.memory.usedJSHeapSize` included Rapier/geometry backing stores (for example, the initial functional records report 662–894 MB). E18 budgets the JS heap. The corrected helper uses `Runtime.getHeapUsage.usedSize` after collection, following the existing E18/L8 performance tests. The original heap value remains in the raw `perf` object, alongside the CDP audit. The 400 MB/250 MB limits are unchanged.
2. Scene Lab pauses the sim. `Game` deliberately skips normal rendering while paused, so the helper's original rAF loop measured idle browser cadence (nearly uniform 18.8 ms), without drawing the scene. The corrected helper explicitly submits each sampled frame and requires at least 180 additional `renderedFrames` before applying the unchanged 16.7/33.3 ms limits. [Initial native records](proofs/summary.json), [initial native log](evidence/small-fixes-browser.log).

The corrected quiet batch also runs the existing E18 desktop, device, memory and horde counter specs plus all three L8 outbreak profiles. Initial measurement failures are retained rather than presented as source regressions or successful native frame-budget evidence.

## Focused WebGL matrix

[Catalog](matrix-webgl2/index.md), [row records](matrix-webgl2/index.json), [log](evidence/matrix-webgl2.log): **144/144 pass**, high and low × zoom 0.5/1/1.5, 659.3 seconds with one browser on the Mac. Filter: `atmosphere*,night-read-*,qa-w6-*,wave3-zoo-routines`. This includes the final L1/L3/L4 day-colour tune and every night navigation fixture.

## Initial download budget

[E18 startup payload](evidence/e18-download.log): **8/8 pass**, both couriers × both quality tiers × both backends, measured through the production Begin flow. [Encoded response-body byte records](e18-download/) retain the worker-inclusive request lists. The 15 MB limit is unchanged.

## Corrected native scene proofs

[36/36 rows pass](proofs-body-final/summary.json), both backends and tiers, with exactly 180 submitted frames per timing row. Maximum static-scene p95: **3.7 ms high / 2.7 ms low**; maximum draws **109 / 89**; triangles **264,239 / 61,690**; collected JS heap **122.438 MB / 81.309 MB**. All original pixel/layout assertions pass again. These posed-scene frame measurements complement the live E18 reference specs, rather than measuring sim cost while the fixture is paused.

[Final quiet admission conditions](evidence/quiet-body-final-conditions.jsonl) record load below 3, no competing headless browser or local Vitest, and all legacy browser slots reserved. Ordinary matrices and counter/memory checks separated the quiet reservations.

## Integration budget fix (`cf7e830f1`)

The merged grips raised L5 low triangles to **496,430 female / 501,086 male**, crossing the unchanged 500,000 cap for the male courier (starting main: **494,218 / 498,874**). Extra infected surface-search precision saved only 118 triangles and was reverted.

The final change lowers the distant civilian **body** target from 0.35 to 0.30. The 1 cm distant position-error limit, near figure preparation, and the curled hand's separate 0.01 target / 1 mm bound remain unchanged. Refreshed 24 LOD2 bakes only; LOD0/LOD1 paths are unchanged. `bake-civilians.ts --lod2` supports this bounded refresh. Final L5 counts: **487,461 female / 492,117 male**, both passing with the original cap. [Per-model triangle deltas](evidence/lod2-triangle-delta.json), [bake log](evidence/bake-lod2-final.log).

- [119 focused tests pass](evidence/geometry-bakes-final.log): shipped/runtime bake equality, worker/build contracts, grips, topology, infected eyes/surface retention and rigid-part LOD geometry.
- [15/15 counters and initial-download checks pass](evidence/e18-counters-bakes-final.log); [final counter/download artifacts](e18-final/).
- [Final memory reload checks pass 2/2](evidence/e18-memory-final.log).
- New matrix scene `wave3-civilian-lod2` covers guard/police/elderly body silhouettes and routine props. The existing `wave3-*` default filters include it automatically. [WebGL2 body/zoo/plaza matrix](civilian-webgl2/index.md): 18/18; [WebGPU](civilian-webgpu/index.md): 18/18. The final guard-focused framing also passes [6/6 WebGL2](civilian-detail-webgl2/index.md) and [6/6 WebGPU](civilian-detail-webgpu/index.md).

No performance budget, test threshold, surface guard, error limit, or PO requirement was loosened.

## Remote suite and timing comparisons

Every full Node sweep ran on Hetzner with at most four Vitest workers. Timing phases and retries used `tools/remote/timing-isolated.sh`. Full merged run on 2.28.24.66: **3,168 passed / 7 timing failures / 11 skipped** (508 files). Full run on 94.130.181.173: **3,175 passed / 2 timing failures / 9 skipped** (508 files). Both continuous L1→L6 policies pass; all functional/campaign files pass. [Slow run](evidence/remote-suite.log), [fast run](evidence/remote-suite-final.log). The subsequent body-only fix is covered by the 119 focused tests above.

| Timing case (4 ms limit for 200) | Merged slow / fast full p95 | Fast isolated | Red on main, slow host yes/no | Red on main, fast host yes/no |
| --- | --- | --- | --- | --- |
| Crossing residency | 4.477 ms / pass | Pass | No | No |
| L10 assault | 4.732 ms / pass | Pass | Yes, 4.074 ms | No |
| Alpha support | 4.055 ms / pass | Pass | Yes, 4.153 ms | No |
| Zoo S1 | 5.115 / 4.116 ms | Pass | Yes, 6.158 ms | No |
| Alpha mixed (the seventh original W6 failure) | Pass / pass | Pass | No | No |
| Alpha physical | 4.094 ms / pass | Pass | Yes, 4.131 ms | No |
| Zoo S2 | 6.779 / 4.108 ms | **4.354 ms**; solo **4.132 ms** | Yes, 5.344 ms | **No** |
| Mega moves (additional slow-run red) | 4.141 ms / pass | Pass | No | No |

[Fresh main original seven: 26/26 on fast host](evidence/remote-main-seven.log); [same slow-host main: 23/28, five timing reds](evidence/remote-main-same-host.log); [merged isolated batch: 27/28](evidence/remote-merged-isolated.log); [fast main repeat: 28/28](evidence/remote-main-fast-repeat.log); [merged S2 solo](evidence/remote-zoo-s2-solo.log); [main S2 solo: 2/2](evidence/remote-main-zoo-s2-solo.log).

Zoo S2 remains an unresolved timing discrepancy on the fast host: main passes there while the merged tree fails slightly above 4 ms. It also fails on slow-host main. Simulation, core, physics and level sources are unchanged; no speculative sim change or threshold relaxation was made. This is measured red, not unmeasured coverage or a green Node suite.

## Live native E18 and phone comparison

The initial native reference battery passed desktop horde, both emulated WebGL devices, both five-load memory cases, high/low horde and L8 high/low: **9 passed, 1 L8 phone sim failure, 4 predefined skips** ([log](evidence/native-final.log)). The final body bakes were then checked again with the [native body batch](evidence/native-body-final.log), final [memory checks](evidence/e18-memory-final.log), and a [clean phone-only comparison](evidence/phone-pair-isolated.log), main first. All quiet reservations stayed below 20 minutes and were separated by ordinary browser work. [Paired admission conditions](evidence/quiet-phone-pair-conditions.jsonl).

| Phone sample | Frame p95, limit 33.3 ms | Sim tick p95, limit 6 ms | Red on main yes/no |
| --- | --- | --- | --- |
| Merged, initial native battery | 32.4 ms, pass | 7.4 ms, fail | Yes for sim (fresh comparisons below) |
| Merged, final body battery | 35.3 ms, fail | 7.9 ms, fail | Frame: no in this pair; sim: yes |
| Main, final body comparison | 30.6 ms, pass | 7.5 ms, fail | Yes for sim |
| Main, isolated reverse-order pair | 32.3 ms, pass | 7.9 ms, fail | Yes for sim |
| Merged, isolated reverse-order pair | **30.1 ms, pass** | **7.6 ms, fail** | Yes for sim |

The frame-time red did not repeat in the clean isolated pair; both builds pass the unchanged frame limit there. All measurements are retained. The L8 phone **simulation** budget remains red on both builds. [Main first record](baseline/l8/perf-phone.json), [main repeat](baseline/l8/perf-phone-repeat.json), [merged body record](e18-final/l8-perf-phone.json), [merged repeat](e18-final/l8-perf-phone-repeat.json). Physical phone recordings and the predefined manual/WebGPU device cases remain skipped; no physical-device certification is claimed.

[Final source L4 sheets](campaign-final/) were recaptured after the body fix on both backends, both tiers and zoom 0.5/1, then opened again. Warm cream roofs/crossings and cool slate-blue bus sides match across backends. Low wheels simplify without losing the bus silhouette.

## Full supplied browser gate

Final source `cf7e830f1`, fresh production build, ports 3651/3652. Typecheck, lint, build and **16/16 smoke** pass. Full WebGPU catalog: **1,407/1,410 pass**, high/low × zoom 1.5/1/0.5, **86 min 29 s**, two headless browsers. Every row was measured. [Gate log](evidence/browser-gate.log), [all row results](full-matrix/index.json), [all contact sheets](full-matrix/index.md). Detailed frame records are retained for failures and the touched atmosphere/phone/window/zoo/civilian fixtures.

| Matrix red | Merged observation | Red on starting main yes/no |
| --- | --- | --- |
| Convoy WebGPU high/z1 | 510 outside pixels, limit 0 | **Yes**, 412 outside pixels |
| Convoy WebGPU high/z1.5 | 3,244 outside pixels, limit 0 | **Yes**, 3,204 outside pixels |
| APC/sedan contact WebGPU low/z0.5 | Silhouette 2/7 = 28.57%, minimum 30% | **Yes**, 2/7 = 28.57% |

Both previously red zoo z1.5 cells now pass with clipping **0**. The supplied script exits 1 at the matrix; its remaining functional and L1 stages run separately. This is not a green deploy gate.

## Final functional and readability battery

After the full matrix exited, ran its exact functional selection plus the full readability set against source `cf7e830f1`: **156 passed / 2 failed**, 158 cases, two headless workers, retries 1, 16 minutes. Required functional selection: **108/108 pass**. Readability: **48/50 pass**. The only failures are the same two L7 courier contrast cases, including after retry: high **2.031598**, low **2.105119** (minimum 3); fresh main also fails both, as shown above. [Final log](evidence/functional-readability-final.log), [Playwright result](readability-final/playwright-results.json), [counts by file](readability-final/counts-by-file.json), [final L7 records](readability-final/).

The final run includes both backends and tiers for E25 night contrast/eyes and E28 weather moods, L3 contrast, weather interactions, foundation smoke, L1/L2/L4 playthroughs, L4 movement/prompts/cellar cameras, WebGPU canvas, respawn/input/crowd/menu checks, and L10 finale/cure interactions.

## Evidence retention

All full-matrix sheets and row-level gates are retained. Final explicit-proof sheets, full phone HUDs, window angle/power comparisons, reviewed close frames, final E18 reference captures and numeric records are retained. Duplicate individual frames from intermediate proof runs and the rejected extra-search trial were pruned; those runs' numeric records/logs remain as measurement history, not final performance claims.

[Fresh main vehicle comparison](baseline/matrix-webgpu/index.md): **9/12 pass**, exactly the same three failing cells, 260 seconds; starting main `a658575f1` production build served with the same runner and fixtures. [Log](evidence/main-matrix-vehicles.log). No measurement-hook patch was needed.

Final L1 grade/look command: **exit 0**, six existing `fixme` skips for retired L1 flow. Current L1 real-input playthrough checks pass in the 108-case functional selection. [Log](evidence/gate-l1-native.log), [quiet admission conditions](evidence/gate-l1-conditions.jsonl). The quiet reservation was released after this short batch.

## Outcome and remaining reds

Both requested lane tips are merged on `lane/merge-batch12`. The newly introduced L5 low-tier budget failure is fixed in `cf7e830f1`; this new red was **not red on main** (501,086 merged male versus 498,874 main, cap 500,000), and the final merged male is 492,117. Full source validation, the explicit phone/window/zoo proofs, required functional browser battery and touched-area backend matrices are complete.

The deploy gate remains **red**: three full-matrix cells reproduce on main; L7 high/low courier contrast and L8 phone sim budgets also reproduce on main. Zoo S2 timing remains an unresolved fast-runner discrepancy (**red on main: no on the fast host, yes on the slow host**). E18 static counters, downloads, reload memory, desktop/horde timing and final isolated phone frame time pass; the phone simulation red prevents claiming every E18 budget holds. No threshold, budget or PO scope was reduced. Physical-phone certification and predefined manual/WebGPU performance cases remain unmeasured/skipped.

No deployment or merge into main was performed.
