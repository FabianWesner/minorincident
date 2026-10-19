# Visual polish — PO 2026-10-19

Base: `2d5e0fb84` (the reported PROD build). No specification changes.

| Finding | Change | Regression evidence |
| --- | --- | --- |
| #4, leaves move with the courier | GPU trajectories stay in world coordinates; focus only selects a whole-field recycling offset. | `visual-polish.test.ts` checks the shader graph's focus dependencies; `polish-leaf-walk` follows the moving courier. |
| #5, green net on the sidewalk | The solid see-through cut retains the first 30 cm above the feet, including the raised Grove paving. The old 8 cm cutoff dissolved the sidewalk and exposed the green ground below. | `polish-grove-patch` uses the exact PO location, compares the cut with see-through disabled, and requires zero changed pixels inside the reveal circle. [Original game-camera capture](before-green-patch.jpg). |
| #21/#29, character shards and crude Alpha corpses | Low has a bounded near LOD1 band. Civilian reductions retain at least 98% of every rigid part's surface, with the distant guard retaining its existing closed uniform reduction; near guards retain 98%. Near infected use their unmodified authored LOD1; distant infected keep the existing surface-preserving reduction. Alpha/Mega frozen corpses use the complete authored LOD0 body; close live Alphas also retain their hero model. Rebuilt the shipped civilian bakes and removed the superseded generation. | `alpha-body-fidelity.test.ts`, `civilian-surface-retention.test.ts`, close-camera browser assertions, `polish-crowd-bodies`, `polish-waiting-crowd`. |
| #24, synchronized exercise idles | Quiet cower, hug, glance and look-around gestures vary by person. A hashed phase offset also separates looping story gestures. | Idle selection/phase regression, and browser assertions for at least three simultaneous gestures and three phase bins. |
| #32, floating red capsules | Blood drops are 1.8–3.5 cm and last at most 180 ms; Full-mode clots and lasting blood use supported ground decals/splats/pools. | `blood-scale.test.ts` measures actual particle attributes and every clot/splat ground height; `polish-blood-ground` captures impact through the settled splats. |
| #40, fists/kick placeholders and missing-position warnings | Non-model entries return no render geometry and ActionView skips loading/equipping them. Pre-render excludes empty streamed geometry. | Registry/warm-up regressions and Playwright listeners on every console severity, from initial load onward. |

[Negative control](validation/baseline-negative-control.txt): the new mechanical regressions produced **10 failures against the original main sources**, covering both tiers where relevant. The idle integration assertion also checks actual drawn production clips, rather than only the selection helper.

The catalog entries are included in `scene:matrix` and its remote counterpart. All browser work uses headless Metal rendering, unique ports 34671–34677, and the shared admission wrapper. CPU suites run on Hetzner with at most four Vitest workers.

## Visual review

Opened the WebGPU high/low game-camera contact sheets at close zoom and inspected the frame sequences. The green triangle is gone: paving and its tile seams remain continuous beside the lamp. The first close review exposed a further asset defect: the retained LOD0 still contained thin clothing/wound shards. The Alpha/Mega asset builders only repaired LOD1/2. The final asset revision applies the same closed-surface method to LOD0 at the existing triangle caps; the new `alpha-solid-near.test.ts` gate covers the delivered geometry. After repacking, opened both final backend mosaics and individual corpse sheets: purple shirt/arms and red Mega chest are continuous, with fingers and boots intact. Alpha/Mega delivered LOD0 open-edge counts fell from 407/439 to zero; source triangles are 7,516/12,624, inside their unchanged 8,000/16,000 caps. Low civilians retain continuous torsos and faces, with separate cowering/hugging/looking gestures. The final close runner uses LOD1 on low and LOD0 on high, with hands/boots intact. Blood reads as small impact droplets followed by flat ground stains, with no lingering vertical capsules. The courier has no unarmed placeholder attached to the chest. The isolated asphalt scenes expose the changed figures; the Grove scene supplies the actual reported street context.

The final [WebGL review](review-final-webgl.jpg) and [WebGPU review](review-final-webgpu.jpg) combine existing game-camera frames at high/low and zoom 1.0/0.5. Both show continuous paving, solid corpse silhouettes and different waiting gestures. The live Alpha is fully visible at zoom 1.0, but its head is cropped at zoom 0.5 in the individual fixture. That framing needs a recapture after the browser pause; the crop does not establish full-body coverage at that zoom. Bright red eyes and facial wounds remain authored details. Contact sheets are review aids; raw close PNGs are in `close/`.

## Validation

| Check | Result |
| --- | --- |
| Typecheck / lint | Passed on final source. |
| Full Hetzner unit suite | **1,666 passed / 9 skipped**, 296 passing files / 1 skipped. [Final log](validation/full-unit-final.log.gz). Includes all 72 bake comparisons, final source and repacked Alpha assets. |
| Alpha asset regressions | **17 passed / 5 files** after repacking; delivered closed-surface gate, rigs, geometry and body fidelity. [Log](validation/alpha-assets-final.txt). |
| Focused Hetzner regressions | **135 passed / 17 files** on final source, including all 72 shipped civilian bake comparisons, the Alpha unload race, floor cutoff, blood scale/ground height and unchanged gore compatibility. [Final log](validation/final-focused.txt). Earlier focused run: [126 passed](validation/targeted-126.txt). |
| Original-source negative control | **10 failed / 1 passed** with the same new mechanical tests against main, without changing budgets. |
| WebGL Scene Lab | **30/30 passed** before the final LOD0 repair: five scenes × high/low × zoom 0.5/1.0/1.5. [Catalog](webgl/index.md), [opened review mosaic](review-webgl.jpg). |
| WebGPU Scene Lab | **30/30 passed** before the final LOD0 repair: five scenes × high/low × zoom 0.5/1.0/1.5. [Catalog](webgpu/index.md), [opened review mosaic](review-webgpu.jpg). Includes the leaf camera walk. The body fixture was recaptured after repair: **6/6 per backend** in [alpha-repair](alpha-repair/), plus three individual body scenes **18/18 per backend** in [individuals](individuals/). |
| Native Playwright body/idle/console checks | **4/4 passed**, WebGL/WebGPU × high/low. All four recorded **zero** fists/kick placeholder or missing-position console lines. [Records](close/), [final runner result](validation/final-browser-results.json). |
| Close-scene geometry counts | Both backends: high **34 draws / 182,905 triangles**; low **27 / 90,125**. These are close-fixture counts, not the horde performance gate. |

The final Alpha unload-race regression and all seven existing E18 deterministic counter checks pass. Low L5: **244 draws / 495,167 triangles**; male courier: **244 / 499,823**, below 300 draws / 500,000 triangles with a tight **177-triangle** margin. [Counter records](validation/). The broad unit/sim/levels run on intermediate source produced **3,172 passed / 14 failed / 11 skipped**. Six asset/prewarm/gore failures were corrected and are covered by the final green full unit suite. The remaining failures were timing assertions/timeouts. An isolated rerun passed **20**, failed **7** timing assertions and skipped 27; corridor and shotgun then passed. A same-runner main-source baseline failed **3/7** selected timings (assault 4.809 ms, zoo S1 4.957 ms, zoo S2 6.389 ms; limit 4 ms). A final four-test recheck passed Alpha and residency, but still failed Alpha physical **4.440 ms** and support **4.825 ms**. These timings remain unresolved; no numeric threshold was changed. `src/sim`, `src/core`, `src/data` and static collision are unchanged. Logs and JSONs are in [validation](validation/). Native E18 desktop/device/horde frame-time coverage is **unmeasured**: the original admission attempt reached 30 minutes at 14:40 UTC, and was stopped under the fairness rule. The complete deploy browser battery and `npm run verify -- E18` are not complete. The orchestrator paused all new browser work at 15:17 UTC to free both slots for merge-batch13a; the current capture batch had completed and this lane’s queued broad gate was canceled. No new browser, e2e-lock or quiet-run batch was started after that instruction. No deploy or merge was performed.

Disk cleanup removed approximately 1 GB of this lane's finished `test-results` artifacts after keeping the selected evidence here. No temporary worktree or distribution copy was created.

## E18 counter investigation

The first counter pass caught low L5 at **586,386 triangles** (male courier: **591,042**). Applying the stronger civilian surface threshold to distant infected was unnecessary: nearby infected now use authored LOD1. Retaining the existing distant-infected reduction reduced those counts to **512,663 / 517,319**. The remaining cost was the distant national guard's small uniform folds: twelve visible guards added **17,496 triangles**. Its distant bake retains the existing reduction; nearby guards retain the stronger surface guard. No test threshold or quality budget was changed. The final rerun passed all seven counter checks at the unchanged budgets (see above).

Full gore's existing bounded-clot regression remains unchanged. Clots now draw as 9 cm supported ground decals; the new blood regression checks every clot and splat's support height as well as particle size and lifetime.

## Reproduction

- `npm run typecheck`; `npm run lint`; fresh `npm run build` inside browser admission.
- Hetzner: `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4`.
- Mac: `E2E_PORT=34674 SCENE_PORT=34671 E2E_UNITS=1 sh tools/e2e-lock.sh ...` for E18 counters, the four new browser checks, and both backend matrices. Matrix filter: `polish-*`, one job.
- Native timing uses `tools/perf/quiet-run.sh`, one worker, unique port 34675, unchanged E18 desktop/device/horde tests. Admission and coverage limits are reported explicitly.

The [opened L5 stress frame](e18-l5-low-male.png) is obscured by the paused chapter-intro fog and “Hours later” overlay; it is counter evidence, not a body-readability claim.

## Review notes

The low resident-prewarm test now requires exactly LOD1 and LOD2 per definition, matching the requested near silhouette policy; high still forbids nonresident hero preloads. Separate high/low Alpha tests require resident LOD0 and forbid nonresident Mega LOD0. No E18 budget was loosened.

A capture retry initially failed at teardown because artifact cleanup raced an active trace writer. Assertions had passed; a clean four-case rerun passed with zero targeted warnings. Finished artifacts are no longer removed while a batch is active. Disk-cleanup deletions under tracked `test-results/` are deliberately excluded from this change.
