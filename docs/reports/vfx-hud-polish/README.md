# VFX / HUD polish — PO 2026-10-19

Base: `20f61f9dd`; continuation from `ae3428567`. Browser pause lifted; a fresh production build now has native headless WebGL2 and WebGPU capture evidence. **E18 is not green:** isolated zoo high simulation p95 remains 5.54 ms against 4 ms. No budget was changed.

## Changes

- L6 retains its authored `prop.service-gate` meshes. Bracing guides use depth-tested, palette-lit yellow floor paint at the crate home positions and gate threshold. Cyan wire cubes, floating rings and arrow are removed; interaction copy names the yellow line.
- Attack warnings retain their pooled identities and real attack lifetimes. Each presentation update selects at most three distinct nearby/imminent dangers, merges similar overlapping lanes, and gives all suppressed warnings a combined opacity budget of 1.5%. Selection runs once per update rather than once per emitted attack.
- A follow-camera displacement over 20 m synchronizes the camera and interpolation history to the courier immediately. L5 entrances/checkpoint jumps cannot present the stale cellar camera with the courier off screen. Normal movement and authored cinematic camera paths retain their existing interpolation.
- Debug Sound/Controls occupy a reserved row above both HUD variants and cinematic letterboxing, including portrait. Opening a control panel reserves its height and moves speaker dialogue below that row; portrait fields fit their column. Compact desktop cinematic subtitles clear the lower letterbox. The production settings remain available through the pause menu.
- Foreground foliage reveals six metres of combat space, projected at the subject rather than capped at 22% of the screen. Solid occluders retain their smaller subject-sized opening.
- Solid masks fully clear their inner disc, removing the retained opaque 35% core that stacked foreground wall fragments into a dark blob. Ordered dithering remains at the feathered edge; ground/support height and per-placement eligibility remain enforced.

## Regression coverage

`tests/unit/render/vfx-hud-polish.test.ts` covers three viewport camera projections, both zooms' canopy clearance, the L6 rendered guide types and the solid shader core. The added horde test in `tests/unit/ui-telegraphs.test.ts` verifies merging, readable count, replenishment after resolution and retained lifetimes.

Original implementation focused run: **12/12 pass** on Hetzner. Replacing the six changed renderer files with their base versions in an isolated remote job makes **8/12 fail** (all seven new render tests and the horde warning test). Existing four telegraph regressions still pass. See [focused.log](focused.log) and [red.log](red.log).

`tests/e2e/vfx-hud-polish.spec.ts` covers Sound/Controls against HUD panels and letterbox at 1280×720, 1920×1080 and 390×844, both HUD variants, high/low quality and zooms 1.5/1/0.5. Its dedicated Playwright config defines native WebGL2 and WebGPU projects and asserts the selected backend. The continuation also checks the real L5 first presented frame and first cellar-emergence frame on both backends and tiers. Results are below.

## Scene Lab catalog and visual review

Five catalog scenes cover #30 L6 gate, #31 L3 charge warnings, #33 L5 cellar, #38 foreground cherry and #39 fire-station wall. The HUD browser suite covers #36. Visual inspection corrected the gate target, replaced the synthetic warning slab with the authored elevated bridge/follow camera, and added an explicit oversized foreground cherry stress fixture at the reported L2 position.

**Final scene matrix: 60/60 pass**, five scenes × two tiers × three zooms × two native backends. Every final contact sheet was opened and described in the [per-capture review](captures.md). The [browser QA narrative](browser-review.md) records rejected early fixtures, initialization limitations, remaining separate findings and performance evidence. All retained captures are linked there or in the capture index.

Native WebGPU exposed a ninth vertex buffer in the warning fade implementation. `fxColor` and `fxVisibility` now share one instanced interleaved buffer, retaining both attributes and the eight-buffer limit. The final matrices have zero console errors; a new unit regression checks shared storage and independent edits.

## Validation

- Typecheck: pass.
- Lint: pass.
- Production build: pass.
- Final focused remote tests: **13/13 pass**, including the new buffer regression; [fresh log](browser-focused.log). Original-source red run: 8 expected failures.
- Historical pre-continuation full unit-only run: **1,656 passed, 9 skipped, 1 asset-validation timeout** (unchanged 300 s limit). The same asset-validation file passed all 17 tests in the combined sweep in 266.94 s. See [unit-summary.log](unit-summary.log).
- Historical pre-continuation combined unit/sim/levels sweep: **3,183 passed, 9 skipped, 2 timing failures** across 509 files. The complete/newbie L1→L6 campaign regression passed. All functional tests passed, including the full unit suite and the 17-test asset-validation file. The two 4 ms timing failures reproduce against the original source as noted below. Four-worker cap retained. See [full-summary.log](full-summary.log).
- Final scene matrix: **60/60 pass**, high/low × zoom 0.5/1/1.5 × native WebGL2/WebGPU.
- HUD/L5 browser suite: **16/16 pass** after all visual corrections, one worker; [captures and review](hud-captures.md), [execution log](browser-hud.log).
- Fresh E18 browser counters: **7/7 pass** after the WebGPU fix. High peak 287 draws / 908,185 triangles; low peak 244 / 492,117, within unchanged budgets.
- Native desktop GPU timing: **5.8/16.7 ms p95 pass**, headless Apple M4 Metal, 12 s / 721 ticks / 2,819 rendered frames; [proof](browser-native-gpu.json). The legacy WebGPU-only performance test remains skipped; both backend scene matrices and HUD suites ran.
- E18 isolated remote timing: Alpha high/low and zoo low pass; **zoo high fails 5.54/4 ms**.
- Full deploy-gate browser battery and epic-wide verification were not rerun in this targeted continuation.

No specs, staticCollision, reference assets or forbidden directories were edited. No deployment or merge.

Reproduction (one browser; unique ports; release and review between batches):

```sh
npm run build
E2E_PORT=3681 SCENE_PORT=3682 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh python3 tools/browser-job.py --seconds 1100 -- npx tsx tools/scenelab/catalog.ts --matrix --filter 'vfx-hud-*' --backend webgl2 --jobs 1 --size 1280x720 --out test-results/vfx-hud-polish/webgl2
# Repeat the preceding batch with --backend webgpu and its own output directory.
E2E_PORT=3681 SCENE_PORT=3682 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh python3 tools/browser-job.py --seconds 1100 -- npx playwright test -c tools/scenelab/vfx-hud-polish.config.ts --workers=1
E2E_PORT=3681 SCENE_PORT=3682 E2E_UNITS=1 sh tools/perf/quiet-run.sh npx playwright test tests/perf/e18-desktop.spec.ts --project=chromium --workers=1
```

Remote E18 timing note: the combined sweep measured Alpha support high p95 **6.08 ms** and zoo S2 high **4.54 ms**, exceeding the unchanged 4 ms caps. Both failures reproduce with the original renderer source in an isolated remote job on another runner (**9.62 ms** and **12.44 ms** respectively under that runner's load). These are baseline timing failures, not a claimed E18 pass. See [base-perf.log](base-perf.log), [Alpha proof](base-alpha-200.json), and [zoo proof](base-zoo-200.json). Other timing checks, including the horde reference, passed; the combined sweep finished with those two timing failures only. The rerun with the existing two-slot timing-isolation wrapper passed Alpha support high at **2.51 ms**, but zoo S2 high still failed at **4.09 ms** against 4 ms (both low-tier cases passed). No sim source changes are part of this patch. The zoo budget remains unresolved; it is not waived. See [isolated-perf.log](isolated-perf.log), [Alpha proof](isolated-alpha-200.json), and [zoo proof](isolated-zoo-200.json).

## Handoff

The assigned scene changes have fresh production-build visual evidence on both native backends. Review [all final scene captures](captures.md), [HUD and L5 transition sheets](hud-captures.md) and the [browser QA narrative](browser-review.md) for the HUD/transition sheets, known limitations and native timing status. The isolated zoo high timing failure remains unresolved and is not waived; this lane does not claim a passing deploy gate. No deployment or merge.
