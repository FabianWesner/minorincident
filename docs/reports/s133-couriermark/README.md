# s133 · Courier crowd marker — work in progress

Acceptance remains open. The current ring is a depth-tested teal annulus (0.57–0.69 m), interpolated with the courier and placed 35 mm above rendered paving. It adds one mesh draw and 96 triangles while on foot, no render pass; these are structural counts, not measured frame-time results. Existing corpse persistence, zombie stats and companion appearance are unchanged.

The existing foreground treatment still uses proximity/crowd/hull triggers. This lane has not yet delivered a new occlusion-only outline. A depth-tested ground ring can still disappear behind corpses; above-corpse ordering is unproven.

## Reviewed evidence

Opened the original batch-108 L4 tick-8139 capture: the teal pack is difficult to locate among large bodies. Opened current WebGL2 L4 HIGH zoom-1 frame 60 and WebGPU L6 HIGH zoom-1 frame 60. L4 retains a visible warm courier edge but the ring is not independently conspicuous. L6 lights the courier strongly; the ring is difficult to distinguish amid feet and red warnings. These observations do not prove a 0.3-second recognition time. No matched before/after sheet is claimed yet.

Raw fixture screenshots and clipping receipts remain in ignored `test-results/s121-courierread/repro-{webgl2,webgpu}-motion/`. The JSON records available fixture results; earlier rows may precede the rendered-paving-height correction. Re-run the complete final matrix after design acceptance.

## Checks and remaining work

Typecheck passed after snapshot instrumentation. Lint passed after that instrumentation. The unchanged required remote unit command passed 105 tests, one skipped, 27 files in 127 seconds on 46.225.66.90. Browser checks use the pool, headless, one browser, ports 5003/5004.

Still required: finish marker/occlusion treatment, final complete backend/tier/zoom matrix, above-corpse/below-body review, measured draw/performance comparison, scene gate rows, real-play L4 HIGH spot via tools/playtest, matched before/after review and one small sheet. This report is a progress receipt, not acceptance signoff.

## Rejected occlusion experiment

A camera-to-torso sphere test replaced the five-nearby-body trigger. Its focused front/rear/off-axis tests passed, but the WebGL2 HIGH L4 fixture failed the existing 90% body-visibility gate. The experiment was reverted; no regression is retained. Conservative pose-aware occlusion remains open.

## Real-play L4 HIGH zoom 1

QA build passed. `E2E_PORT=5003 SCENE_PORT=5004 MI_BROWSER_POOL=1 npx tsx tools/playtest/play.ts --levels L4 --quality high --zoom 1 --capture-zooms 1 --weapon weapon.army-mg --level-minutes 3 --session-seconds 180 --no-skip --out test-results/s133-couriermark/l4-real` ran its bounded 180-second sample through the pool. Exit 1 represents unfinished level at the sample limit; no objective was skipped. One early empty-HUD navigation warning was recorded. The driver reached west, north and south breach objectives.

Opened tick 5424 and tick 8136 captures. The small teal ring clearly locates the courier in active north-breach combat, including among corpses, armed figures, Alphas and red warnings at tick 8136. These are different combat configurations from the original batch-108 complaint frame; they establish real-play utility, not a matched before/after or universal 0.3-second test. Raw receipts remain in the ignored output directory.

## Matched sheet and focused gates

`contact.jpg` is the single small sheet: matched L4/L6 HIGH zoom-1 moving-crowd frame-60 views, marker geometry disabled/enabled without changing poses or camera. Opened and reviewed it: most of the ring is hidden by bodies and the fixture improvement is weak, despite its clearer utility in real play. This does not close recognition acceptance. `tools/scenelab/courier-mark-review.ts` reproduces it through the pool on 5003/5004. Captured triangle delta is +96 in each scene. Zero-range meshes still count in the renderer draw counter (127/127 L4, 77/77 L6), so this comparison does not independently measure the structural +1 draw. No native frame-time claim is made.

Focused existing scene gate selection passed 10/10 across its authored WebGL2/WebGPU HIGH/LOW/zoom rows: courier gear, locomotion, turns, armed male/female, vehicle admission and bar-cap horde. Full gate coverage is still pending. Output: `test-results/s133-couriermark/gate/`. Typecheck and lint passed with the matched capture tool.

## Corpse-layer correction

The marker now draws as an opaque depth-writing ring at order 1.5 and uses the existing living stencil bit. Living bodies/world props draw first and depth-test normally; later corpse draws respect the ring stencil. This retains a single mesh and no new pass. The ring is now solid muted teal rather than transparent.

Extended the matched capture tool with `--corpses` (existing Scene Lab command, first 16 infected become retained corpses) and `--webgpu`. Both WebGL2 and WebGPU HIGH corpse variants completed. Opened WebGL2 L4 after and WebGPU L6 after: a teal arc survives among bodies, clearly around the L6 courier's feet, while nearer living figures cover portions. These are bounded visual checks, not universal layering proof. Latest raw corpse captures are WebGPU under `review-corpses`; the second run overwrote the first backend's images. Typecheck and lint passed. Final matrix, gate rerun, unit suite and sheet refresh must follow this rendering change.

## Pose-volume occlusion candidate

Replaced the five-nearby-body crowd trigger with camera rays toward courier head/torso, tested against conservative body-height samples (ordinary radius 0.8 m, Alpha 1.4 m, Mega 2.4 m). Off-axis and rear figures no longer activate that crowd branch solely by proximity. Existing hull, Mega and large-corpse handling remains. This is a conservative approximation, not pixel-exact occlusion.

The WebGL2 HIGH moving L4/L6 matrix at zoom 1/1.5 passed with this candidate. Typecheck/lint passed; existing 14-case render-contract suite passed after extending its foreground helper with front/rear/off-axis/hidden/dead controls. LOW/WebGPU, runtime cost and large-corpse trigger refinement remain to qualify.

## Current-revision validation (58cd1a5c)

Both full moving-fixture backend runs passed L4/L6 × HIGH/LOW × zoom 1/1.5, sampled at frames 1/30/60. Required unchanged remote `sh tools/remote/run.sh "$PWD" -- npm test` passed 105 tests, one skipped, 27 files in 127.7 s (240 s budget), runner 46.225.66.90. JSON matrix receipts refreshed from these runs.

A warmed Node benchmark of the body-overlap helper scanned 160 no-hit figures for 30,000 calls: median 0.00362 ms, p95 0.00491 ms. This bounds helper CPU cost only; it does not measure native renderer/GPU frame-time delta. Recognition acceptance, final sheet refresh, current-revision gate rerun, large-corpse trigger refinement and full-frame timing remain open.

## Full current scene gate

On source revision 492bab69, `E2E_PORT=5003 SCENE_PORT=5004 MI_BROWSER_POOL=1 npx tsx tools/scenelab/gate-run.ts gate --out test-results/s133-couriermark/gate-current --jobs 1 --batch 10` completed exit 0. All 91 curated rows passed with no known/not-run rows. Required vehicle-contact HIGH/LOW and native L9/L7/L4 campaign motion follow-ups also passed exit 0. The source stayed unchanged for the entire sequential pooled run. This supersedes the earlier focused-only gate status.

## Native timing harness

Extended the existing matched review tool with `--perf`: native uncapped Chrome, 180 warm frames and 600 measured render updates per marker-off/on view. Requires `tools/perf/quiet-run.sh`; normal pooled invocation correctly rejects uncapped timing. Initial admitted attempt exposed tsx `__name` injection in a nested page helper; removed that helper. The corrected attempt remained in quiet-admission wait because host load stayed above the <3 threshold; cancelled before measurement (exit 75, exclusive admission cancelled). No native timing result is claimed. Typecheck/lint passed for the tool before the nested-helper removal.

Reproduce when the host is quiet: `E2E_PORT=5003 SCENE_PORT=5004 MI_BROWSER_POOL=1 sh tools/perf/quiet-run.sh npx tsx tools/scenelab/courier-mark-review.ts --perf`.

## Refreshed current sheet

Replaced the single `contact.jpg` with four current-source matched marker-off/on pairs: living L4/L6 and corpse-heavy L4/L6, HIGH zoom 1, identical camera and pose within each pair. Opened and inspected the sheet. Corpse-heavy L6 shows a clear teal arc around the feet; L4 shows a smaller arc among bodies. Living-only dense views still cover most of the ground cue, leaving the existing contour as the locator. This bounded review supports utility but does not establish every-frame 0.3-second recognition. Both fresh WebGL2 capture runs completed exit 0; no behavior changed.

## Courier identity contour

Changed only the courier contour from warm gold to restrained teal (`#80ddce`), matching the ground cue. Close-view grazing falloff widens slightly (power 3→2), strength .55→.65; hull x-ray edge .14→.2. Companion fallback explicitly retains gold; no zombie/corgi material change. Existing uniforms and draws are reused. Opened current L4 HIGH zoom-1 frame 60: teal head/torso/arm edges separate the courier from warm crowd clothing even when the ground ring is hidden. WebGL2 HIGH moving L4/L6 at both zooms passed; typecheck/lint passed. The earlier full matrix, gate and remote-suite results predate this contour-only change and must not be represented as its final validation.

## Teal-contour remote suite

Required unchanged remote unit command passed on c7ec3256: 105 passed, one skipped, 27 files, 132.2 seconds within 240-second budget, runner 46.225.66.90. Corrected native timing attempt remained in quiet admission (host load >3), then was cancelled without a measurement. Pool wrapper reads `E2E_ADMISSION_TIMEOUT_SECONDS`, whereas the attempted `MI_PERF_ADMISSION_TIMEOUT_SECONDS=120` only controls the legacy path; future retries must set the pool variable. No running check remains from this attempt.
