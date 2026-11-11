# s38-zoonight — verification in progress

The rendering changes are committed, but the full requested acceptance criteria are not yet met. In particular, zebra display-luma percentile contrast is 1.22× baseline rather than the required 2×.

## Cause and change

The additive coat fill and cool figure fill washed zoo coats toward pale green and flattened the tan cats. CrowdView now reduces flat fill, restores neutral coat hue, and gives gorilla fur a dark warm-neutral base. Species-specific material constants have distinct cache keys. The existing moonlit rim and attack feedback paths remain in place.

The courier's near-camera visibility slice displayed detailed, bright clothing over a whole vehicle hull, which read as standing on its roof. Removing that slice failed visibility (0.10 versus the unchanged 0.60 minimum), so it is retained. Vehicle x-ray now suppresses clothing detail and uses a dim blue-grey fill and restrained edge.

Only render code and Scene Lab diagnostic metrics changed. No stats, AI, simulation, or animation clips changed. No dependencies or new test cases were added. The measured original and revised lineup both use 29 draw calls.

## Quantitative comparison

## Measured original versus neutral-hue revision

Matched WebGPU low Scene Lab lineup, f0, zoom 1.5. Original sources were captured from HEAD, then the edited sources were restored. Full RGB/saturation/luma samples: `before-after-low-webgpu.json`.

| Animal | Original mean RGB | Revised mean RGB | Original → revised luma mean | Original → revised luma std |
|---|---|---|---|---|
| Gorilla | 82.92 / 99.21 / 88.99 | 49.77 / 51.17 / 52.69 | 95.01 → 50.98 | 41.55 → 36.87 |
| Zebra | 115.17 / 119.73 / 100.06 | 69.93 / 72.28 / 77.55 | 117.34 → 72.17 | 47.43 → 52.15 |
| Lion | 182.67 / 121.27 / 61.52 | 131.92 / 96.21 / 70.08 | 130.01 → 101.91 | 28.56 → 30.57 |
| Lioness | 189.01 / 132.88 / 59.29 | 133.31 / 102.69 / 72.19 | 139.50 → 107.00 | 17.56 → 22.96 |

Opened `test-results/s38-neutral/night-boss-zoo-lineup/sheet.jpg`: gorilla reads as dark warm grey, zebra stripes are visible, both cats retain tan shading. This is partial evidence: the complete matrix, stripe percentile contrast target, real fixtures, L4 bus capture, and final checks remain outstanding.

## Matrix and acceptance status

`matrix-metrics.json` contains the target-animal samples for WebGL2/WebGPU × low/high × zoom 1/1.5. Lion and lioness low/high luma-standard-deviation ratios are 1.0. Gorilla revised mean RGB is near neutral and luma is below baseline. The revised zebra p90−p10 is 152.6 at zoom 1.5 and 155.1 at zoom 1. Original WebGPU low zoom-1.5 contrast is 125.43, so the revision reaches 1.22× rather than 2× (250.86 on a 0–255 scale). That requirement remains open.

The zoom-1 lineup rows fail the unchanged monkey control because it is offscreen; all four target animals have nonzero measured masks. Zoom-1.5 rows pass. The complete matched baseline matrix and equivalent fixture pixel measurements are not yet present. `intermediate-metrics.json` records an earlier revision and is not final acceptance evidence.

## Captures opened

Raw images remain in ignored `test-results/`; only one small contact sheet is committed.

- Original r38 gorilla, lion, zebra, and L4 bus images were opened from the QA scratchpad cited in `docs/reports/r38-vqa/README.md`.
- `s38-neutral/night-boss-zoo-lineup/sheet.jpg`: dark warm-grey gorilla, striped zebra, shaded tan cats.
- `s38-fixture-gorilla-arena/s005-t1607.jpg`: live gorilla, WebGL2 low z1.5, dark charcoal/brown fur, pale moon edge and amber ring.
- `s38-fixture-lion/s005-t1579.jpg`: live lion, WebGPU low z1, tan body with darker underside and mane; amber pounce and red threat cues intact.
- `s38-fixture-zebra-visible/s004-t792-idle.jpg`: live zebra, WebGPU low z1.5, distinct dark/pale stripes without the prior glassy green cast; amber/red ring intact.
- `s38-l4-production-bus-before/s000-t64-idle.jpg` and `s38-l4-production-bus/s000-t64-idle.jpg`: actual L4 line-break checkpoint, WebGL2 low z1, matched bus-relative setup and tick. Original gold clothing reads above the roof; revised dim silhouette reads through the intact hull. See [contact sheet](bus-before-after.jpg).

Production fixture runs log all setup in their `log.jsonl`. Gorilla and lion use real-input arena routes. The zebra capture enters `(60,34)`, waits 8.5 seconds for encounter activation, then places the courier 2 m beside a living active zebra within the enclosure. L4 selects the actual EVAC bus and places the courier at `(bus.x−2.4,bus.z−2.4)`. These setups affect captures only. Each run reports no page errors and its owned server was stopped.

The fixed L4 courier ROI's changed pixels drop mean luma 141.78 → 92.72 and RGB 182.80/134.64/91.76 → 87.37/92.99/105.73. `bus-comparison.json` records the diagnostic mask and its pose-edge limitation; this is not a semantic body mask.

## Checks

- Required slim-worktree command passes after full access became available; node_modules was populated.
- Typecheck and lint pass on the committed rendering source.
- Latest QA build passes (tree d200a1ed62fb2213aa9a3097f06ecd9c867752ca).
- Remote `tests/shared/render-contracts.test.ts`: 14/14 pass with at most 4 workers.
- Targeted gate run: 9/9 on the earlier material revision; current neutral-hue matrix retains the zoom-1 monkey framing failures described above. Current bus Scene Lab visibility and whole-hull controls pass.
- Diff whitespace check passes. No tolerance was loosened. No quiet-run or timing reservation was used.

## Work remaining

Meet the zebra contrast requirement or obtain an explicit revised criterion; collect the missing matched baseline/fixture matrix; repair the zoom-1 control framing without weakening checks; complete the final gate and capture audit. This report does not claim the goal achieved.

Framing correction: the zoom-1 monkey failure was specifically the f60 outward hit response (projected x0=1039 on a 960-pixel canvas), not idle or walk. The existing lineup now hits the monkey inward from `[9,-3.5]`, preserving the actor and thresholds. WebGPU low zoom 1 passes all existing checks (`test-results/s38-framing`). The remaining matrix must be recaptured with this fixture correction.

Final corrected-framing lineup: 8/8 rows pass across WebGPU/WebGL2 × low/high × zoom 1/1.5 (`test-results/s38-final-webgpu`, `s38-final-webgl2`). `matrix-metrics.json` now contains these fresh samples. This supersedes the earlier offscreen-monkey failures; it does not supersede the open 2x zebra target.

Matched full Scene Lab baseline is now captured: original source from `6a116ada^`, corrected fixture framing, both backends, both tiers, both zooms; current source restored afterward. Baseline 8/8 rows pass. `matched-matrix.json` stores all 96 paired target-animal samples (8 rows × 3 frames × 4 animals), including RGB, saturation, mean/std/p10/p90 luma. Gorilla luma drops by 38.72–51.89; zebra contrast ratios are 1.177–1.236. Opened matched WebGPU low z1.5 sheets in `s38-baseline-webgpu` and `s38-final-webgpu`: the baseline pale-green gorilla/zebra become dark gorilla and dark/pale striped zebra. This closes the Scene Lab baseline-matrix gap, but not the requested fixture pixel matrix or 2x zebra criterion.

Additional stripe experiments (not retained): direct high-brightness coat mapping caused glowing whites and contrast 119.3; steeper dark/pale separation yielded 180.0; raising its whites to 4 yielded clipped whites plus bloom, contrast 212.0. None reaches the 250.86 target. Outputs are in `test-results/s38-stripe-experiment`, `s38-stripe-step`, and `s38-stripe-step4`. The experiment and step sheets were opened. Current shaded material was restored; these outputs are not acceptance evidence.

Fixture pixel measurement tooling now supports `--measure infected.gorilla,...`, reusing Scene Lab's projected body bounds and crowd mask on a final paused frame, with `figure-metrics.json` and `measured.png`. Validated on production `l8-before-gorilla`, WebGL2 low z1.5: 7,183 body-mask pixels, mean RGB 45.63/45.74/48.13, saturation 0.0891, luma 45.89, std 39.32. Output: `test-results/s38-fixture-measured-gorilla`. This is one current sample, not the complete matched fixture matrix. Typecheck passes.

Matched production gorilla fixture matrix is complete: 16 runs (before/after × WebGL2/WebGPU × low/high × zoom 1/1.5), all nonempty body masks. Original mean luma ranges 87.64–96.02; revised ranges 41.61–45.03. Full RGB/saturation/percentile data: `gorilla-fixture-matrix.json`; raw captures: `test-results/s38-fixture-matrix/`. Opened revised WebGPU high z1.5 `measured.png`. Wall-clock fixture sampling gives small pose/pixel-count differences, recorded rather than hidden. Current source restored and owned server stopped after the process exited successfully. Lion/zebra matched fixture matrices remain outstanding.

Lion measurement pilot: dormant/offscreen active entities initially had no projected bounds, so fixture measurement selection now requires a drawn crowd figure. A 14-second WebGL2-low-z1.5 pilot yields nonempty lion and lioness samples; opened `test-results/s38-lion-measure-pilot/measured.png`. Nearby figures overlap their projected bounds, so these all-crowd-mask statistics can include overlap pixels and are not isolated coat measurements. Typecheck passes. The failed matrix attempt restored source and stopped its server before this correction.

QA mask refinement: fixture samples now request a species-specific CrowdView mask while all other scene objects remain black depth occluders. This excludes neighbouring human pixels inside an animal's projected bounds. Default Scene Lab calls retain the full crowd mask. Typecheck and diff checks pass; runtime validation and replacement cat fixture samples remain required.

Species-mask runtime validation: corrected `infected.*` → `inf.*` batch aliases. The corrected lion pilot reports 2,328 lion pixels (luma 65.21) and 2,912 lioness pixels (107.51), excluding neighbouring human pixels. Output: `test-results/s38-lion-species-mask-fixed`. Measurement requests now fail on empty/zero-pixel samples rather than recording misleading zeros.

Matched production cat fixture matrix: sixteen runs (before/after × both backends × both tiers × both zooms), using species-isolated masks, with nonempty lion and lioness samples in every run. Revised low/high luma-std ratios range 0.927–1.055, above 0.8 for each species/backend/zoom pair. Full measurements: `lion-fixture-matrix.json`; raw output: `test-results/s38-fixture-matrix/lion-isolated-*`. Real-time capture poses differ slightly; sample pixel counts are preserved. Current source restored and owned server stopped after successful completion. Zebra matched fixture matrix remains outstanding.

Matched production zebra fixture matrix completed: 16 runs, nonempty species-isolated masks in every run. `zebra-fixture-matrix.json` records per-entity values and visibility/sample counts. Mean visible-zebra p90−p10 across each run ranges 116.2–128.3 before and 119.4–133.3 after; this does not meet 2x. Counts vary between one and two visible zebras, so aggregate means are not exact same-entity/pose comparisons. Opened revised WebGPU-high-z1.5 `measured.png`. Current source restored and owned server stopped. Raw output: `test-results/s38-fixture-matrix/zebra-*`.

Latest validation after species-mask fixes: typecheck, lint, and QA production build all pass (tree 39e63c56050db318e855781df4d2c3dcb7a67c5c). The shared HDR bloom pipeline has no current per-animal exclusion. Earlier high-white stripe experiments bloom into dark stripes and still miss 2x; the current shaded revision is retained while that acceptance conflict remains unresolved.
