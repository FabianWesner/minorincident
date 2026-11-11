# s38-zoonight — in progress

## Cause

- Zoo boss surfaces received a shared additive night coat fill and a strong figure fill. That pushed dark gorilla fur toward pale green-grey, reduced zebra black/white contrast, and flattened low-quality lion shading.
- The courier foreground depth node used the near-camera slice whenever foreground mode was active, even when `courierXray` indicated vehicle occlusion. That put her silhouette in front of the bus roof.

## Change so far

- `CrowdView` now uses smaller per-draw night coat fills for zoo animals, a dark warm-neutral gorilla base, and a lower shared boss figure fill. The rim setting and attack flash path are unchanged.
- The courier depth slice is disabled while the vehicle x-ray flag is active. Her x-ray fill is dimmed and its gold contour is restrained.
- No simulation, stats, or animation-clip code changed.

## Before/after measurements

The requested pixel measurements have not been collected yet. The before captures below were opened and confirm the reported appearance; no after captures were generated because the local browser pool could not bind a loopback listener in this sandbox. Numeric before/after RGB, saturation, luma, stripe contrast, and lion variance must be added after Scene Lab runs.

| Subject | Before evidence opened | Before numbers | After numbers |
|---|---|---:|---:|
| Gorilla | r38 `crop-gorilla.jpg` — pale grey-green body under the night key | Not measured | Pending |
| Zebra | r38 `burst-zebra-s023.jpg` — stripes visible but pale green cast | Not measured | Pending |
| Lion/lioness | r38 `crop-lion-low-z1.jpg` — flat bright ochre at low quality | Not measured | Pending |
| Courier behind L4 bus | r38 `l4-north-low-z1-gl/s035-t6636.jpg` — full-bright silhouette on the roof | Not measured | Pending |

Original captures are in the r38 QA scratchpad and are not copied into the repository:
`/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r38-vqa/`.

## Checks

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build:qa` — passed.
- `git diff --check` — passed.
- Scene Lab gate for `night-boss-zoo-lineup`, `night-boss-lion`, and `seethrough-engine-on-foot` — not run. Both the normal runner and the `node --import tsx` retry failed because the browser-pool daemon was denied permission to listen on loopback (`EPERM`, ports 4329 and 4321).
- Required `sh tools/ops/slim-worktree.sh "$PWD" --no-assets` — attempted first; failed because sandbox permissions deny locking the shared worktree git config at `.git/worktrees/s38-zoonight/config.worktree`.

## Still required

Run the low/high, WebGL2/WebGPU Scene Lab matrix and L8 fixture captures, plus an L4 bus-occlusion capture. Open the after captures, calculate per-animal pixel metrics against the corresponding before images, update this report, then commit the render changes and report.

## Full-access continuation

Slim-worktree now passes. Targeted Scene Lab completed: all eight zoo lineup/lion rows pass across both backends and qualities at zoom 1.5. Vehicle visibility failed at 0.10 against the existing 0.60 minimum; the depth-slice removal was reverted. Output: `test-results/s38-after/`. Pixel metrics, zoom 1, fixture captures and final visual review remain outstanding.

## Measured original versus neutral-hue revision

Matched WebGPU low Scene Lab lineup, f0, zoom 1.5. Original sources were captured from HEAD, then the edited sources were restored. Full RGB/saturation/luma samples: `before-after-low-webgpu.json`.

| Animal | Original mean RGB | Revised mean RGB | Original → revised luma mean | Original → revised luma std |
|---|---|---|---|---|
| Gorilla | 82.92 / 99.21 / 88.99 | 49.77 / 51.17 / 52.69 | 95.01 → 50.98 | 41.55 → 36.87 |
| Zebra | 115.17 / 119.73 / 100.06 | 69.93 / 72.28 / 77.55 | 117.34 → 72.17 | 47.43 → 52.15 |
| Lion | 182.67 / 121.27 / 61.52 | 131.92 / 96.21 / 70.08 | 130.01 → 101.91 | 28.56 → 30.57 |
| Lioness | 189.01 / 132.88 / 59.29 | 133.31 / 102.69 / 72.19 | 139.50 → 107.00 | 17.56 → 22.96 |

Opened `test-results/s38-neutral/night-boss-zoo-lineup/sheet.jpg`: gorilla reads as dark warm grey, zebra stripes are visible, both cats retain tan shading. This is partial evidence: the complete matrix, stripe percentile contrast target, real fixtures, L4 bus capture, and final checks remain outstanding.

## Percentile metrics and WebGPU matrix

`tools/scenelab/run.ts` now records p10/p90 luma and their difference using the existing body mask. The neutral-hue revision was measured at both quality tiers and zooms 1/1.5 (`test-results/s38-matrix-webgpu`). For the four requested animals, low/high measurements match: lion/lioness shading-std ratio is 1.0. Zebra p90-p10 is 155.1 at zoom 1 and 152.6 at zoom 1.5. Gorilla luma is 42.27 / 50.98 at zoom 1 / 1.5. Original percentile comparison remains pending.

The zoom-1 rows fail the existing monkey control because it has zero measured pixels; all four requested animals have nonzero masks. This failure is retained and no tolerances were changed.

The WebGL2 matrix now also completes. Both zoom-1 rows retain the same offscreen-monkey failure; zoom-1.5 rows pass. All target-animal samples are in `matrix-metrics.json`. Original zebra p90-p10 at WebGPU low zoom 1.5 is 125.43; revised is 152.6 (1.22x), below the requested 2x. This remains an open requirement.

An EVAC-bus static-prop Scene Lab capture was opened (`test-results/s38-bus-after/shot-0000.png`). It uses a reveal cut (16,147 cut pixels), so it does not prove the production full-hull x-ray requirement. The inherited zero-cut check fails and is recorded. Vehicle-path capture remains required.

## Vehicle silhouette revision

Opened the vehicle-path bus captures (`test-results/s38-bus-vehicle/shot-0000.png` and `test-results/s38-bus-tinted/shot-0000.png`). The first retained detailed clothing and read as standing on the roof. The revision suppresses clothing detail and uses a dim blue-grey x-ray fill with a restrained edge. The opened revised image reads as a silhouette through the hull; the unchanged visibility, whole-hull and console checks pass. This school-bus Scene Lab control is not the requested production L4 EVAC fixture proof, which remains required.

Loaded and played `l8-before-gorilla` for 15 seconds (WebGL2 low, zoom 1.5); opened `test-results/s38-fixture-gorilla/s000-t73.jpg`. This starts outside the gorilla arena, so it is not gorilla appearance proof. Retained zebra bodies in that production fixture show distinct black/white stripes. A route through the arena entry is still needed for the live boss capture. The owned fixture dev server was stopped after the run.

## Live gorilla fixture

`l8-before-gorilla`, WebGL2 low, zoom 1.5, god mode, real-input route `60,0;60,-17;60,-25`, 30 s: reached `arena-gorilla`, no logged page errors. Opened `test-results/s38-fixture-gorilla-arena/s005-t1607.jpg`: dark charcoal/brown fur, pale moonlit edge, amber ring intact. Typecheck and lint pass on this revision. Owned fixture server stopped automatically after the run.
