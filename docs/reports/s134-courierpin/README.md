# s134 · Courier occlusion pin

## Current result

Replaced s133's always-visible, depth-tested ground ring with a small paired teal chevron above the courier. The hollow shape faces the camera, has a dark edge, disables depth testing, and scales with camera distance to keep its screen size steady across zoom. It appears only during on-foot gameplay when the camera-to-courier body checks detect an occluding body or Mega. Hidden courier states, riding, and story shots suppress it. The courier and infected stats and corpse lifetime are unchanged.

The pin uses two simple meshes and no new render pass. Its draw/triangle delta and visual recognition have **not** been measured in this environment.

## Checks completed

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npx vitest run tests/shared/render-contracts.test.ts --maxWorkers=4 --configLoader runner` — 14 passed.
- `npm test` — full configured suite completed locally in 90.5 s: 106 passed, 44 skipped, 27 files. The unchanged required remote invocation, `sh tools/remote/run.sh "$PWD" -- npm test`, could not start because no healthy runner was provisioned; the documented local fallback also rejected this invocation.
- `git diff --check` — passed.

## Open acceptance evidence

The matched s133/current sheet and the cross-product L4/L6 moving matrix (WebGL2/WebGPU, HIGH/LOW, zoom 1/1.5), real-play L4 HIGH spot, draw/triangle delta, and final scene gate are not verified. The mandated browser-pool capture command failed before launching a browser: its control server received `listen EPERM` on 127.0.0.1:4329. Port 3300 had no server to reuse. No screenshot is included because no current-source frame could be captured; the harness is ready at `tools/scenelab/courier-mark-review.ts --baseline` for an admitted headless pool.

My visual verdict is therefore **unverified** for L4 dense, L6 dense, and calm L1. Source behavior predicts the cue will activate in the dense fixtures and stay hidden in a calm frame, but that does not establish that the courier is findable at a glance or that the pin is tasteful. Do not treat this report as completion of the acceptance goal.

## Reproduction

```sh
E2E_PORT=5005 SCENE_PORT=5006 MI_BROWSER_POOL=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/courier-mark-review.ts --baseline
```

The capture produces identical-setup s133/current L4, L6, and calm L1 frames. After capture, make one small comparison sheet, inspect it at full size, record the first eye landing per frame, and run the required backend/tier/zoom matrix and scene gate before closing this report.

## Resumed evidence

With unrestricted execution, the required remote suite passed on 46.225.66.90: 105 passed, one skipped, 27 files, 130.5 seconds. The pooled matched capture completed. Opened `test-results/s134-courierpin/review/l4-baseline-after.png`: teal contour visible but overhead pin absent. This frame fails recognition acceptance; diagnose marker rendering/visibility before continuing. Previous environment limitations are resolved.

## Current placement and moving matrix

Lowered the chevron to the courier hair rather than a rear zombie. Scene Lab uses a cinematic preset for gameplay fixtures; the named `scene-lab` debug preset is exempted from story suppression while real story shots remain suppressed. Fixed the baseline to 4dca98d8 and port 5005.

Opened the latest full-size L4/L6/calm L1 after captures and [contact.jpg](contact.jpg). L4 eye lands on the teal chevron at the courier hair and follows her outlined body; L6 eye lands on her already lit body. Calm L1 has no pin and no ground ring. The small sheet compresses the pin, so full-size captures were also reviewed.

Both moving matrices passed: 24 samples per backend across L4/L6, HIGH/LOW, zoom 1/1.5, frames 1/30/60. Minimum body-mask share 1.0 WebGL2 / 0.9989396 WebGPU. These masks establish visibility, not recognition speed. Final scene gate, real-play spot, counters, and broad visual review remain open.

## Draw cost and expanded review

Matched s133/current HIGH z1 f60 counters: L4 127→128 draws, 340972→340884 triangles; L6 77→78 draws, 277176→277088 triangles. Calm L1 68→67 draws, 47877→47781 triangles. Dense delta **+1 draw, −88 triangles**, calm delta **−1 draw, −96 triangles**, no new pass. This replaces one 96-triangle ring with two four-triangle chevrons only when active.

Opened LOW z1.5 L4 full-size captures on both backends and an eight-frame backend comparison of L4 HIGH z1/z1.5 and L6 LOW z1/z1.5 f60. Backend output appears consistent. L4 chevron is readable at the courier hair at both zooms; L6 eye lands on her lit body first. Final gate is in progress; 32 LOW rows passed before waiting on another job’s live exclusive pool reservation.
