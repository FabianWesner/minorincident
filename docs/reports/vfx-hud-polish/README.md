# VFX / HUD polish — PO 2026-10-19

Base: `20f61f9dd`. Browser validation is unmeasured: the orchestrator’s merge-batch13a pause has not been lifted. No browser slots were acquired.

## Changes

- L6 retains its authored `prop.service-gate` meshes. Bracing guides use depth-tested, palette-lit yellow floor paint at the crate home positions and gate threshold. Cyan wire cubes, floating rings and arrow are removed; interaction copy names the yellow line.
- Attack warnings retain their pooled identities and real attack lifetimes. Each presentation update selects at most three distinct nearby/imminent dangers, merges similar overlapping lanes, and gives all suppressed warnings a combined opacity budget of 1.5%. Selection runs once per update rather than once per emitted attack.
- A follow-camera displacement over 20 m synchronizes the camera and interpolation history to the courier immediately. L5 entrances/checkpoint jumps cannot present the stale cellar camera with the courier off screen. Normal movement and authored cinematic camera paths retain their existing interpolation.
- Debug Sound/Controls occupy a reserved row above both HUD variants and cinematic letterboxing, including portrait. Opening a control panel reserves its height. The production settings remain available through the pause menu.
- Foreground foliage reveals six metres of combat space, projected at the subject rather than capped at 22% of the screen. Solid occluders retain their smaller subject-sized opening.
- Solid masks fully clear their inner disc, removing the retained opaque 35% core that stacked foreground wall fragments into a dark blob. Ordered dithering remains at the feathered edge; ground/support height and per-placement eligibility remain enforced.

## Regression coverage

`tests/unit/render/vfx-hud-polish.test.ts` covers three viewport camera projections, both zooms' canopy clearance, the L6 rendered guide types and the solid shader core. The added horde test in `tests/unit/ui-telegraphs.test.ts` verifies merging, readable count, replenishment after resolution and retained lifetimes.

Focused run: **12/12 pass** on Hetzner. Replacing the six changed renderer files with their base versions in an isolated remote job makes **8/12 fail** (all seven new render tests and the horde warning test). Existing four telegraph regressions still pass. See [focused.log](focused.log) and [red.log](red.log).

`tests/e2e/vfx-hud-polish.spec.ts` covers Sound/Controls against HUD panels and letterbox at 1280×720, 1920×1080 and 390×844, both HUD variants, high/low quality and zooms 1/0.5. Its dedicated Playwright config defines native WebGL2 and WebGPU projects and asserts the selected backend. It has not run during the browser hold.

## Scene Lab catalog and visual review

Five added `tests/scenes/catalog/vfx-hud-*.json` scenes cover the service gate, the reported L2 cherry canopy location, the L1 fire-station wall, L5 opening and twelve simultaneous charge warnings. All five pass Node spec validation and match the existing `vfx-*` matrix selector in both local and remote matrix commands. Intended local checks use a fresh production build, `SCENE_SERVER=preview`, unique ports and the shared browser lock, on both WebGL2 and WebGPU and both quality/zoom rows.

The supplied before image `30-L6-debug-gizmos-courier-disc-rings.jpg` was opened: bright cyan cube edges, wide rings, a hovering arrow and a floating threshold stripe dominate the tunnel; Sound intersects the objective chip. New game-camera captures and their review are pending browser admission. The supplied horde image `31-L3-bridge-horde-telegraph-carpet.jpg` was also opened: intersecting red lane edges and fills dominate the whole bridge surface around the courier, obscuring the road direction. No new visual or native-GPU performance pass is claimed yet.

## Validation

- Typecheck: pass.
- Lint: pass.
- Production build: pass.
- Focused remote tests: 12/12 pass; original-source red run: 8 expected failures.
- Full unit-only run: **1,656 passed, 9 skipped, 1 asset-validation timeout** (unchanged 300 s limit). The same asset-validation file passed all 17 tests in the combined sweep in 266.94 s. See [unit-summary.log](unit-summary.log).
- Combined unit/sim/levels sweep: **3,183 passed, 9 skipped, 2 timing failures** across 509 files. The complete/newbie L1→L6 campaign regression passed. All functional tests passed, including the full unit suite and the 17-test asset-validation file. The two 4 ms timing failures reproduce against the original source as noted below. Four-worker cap retained. See [full-summary.log](full-summary.log).
- Browser matrix, HUD overlap test, E18 native budgets and epic browser verification: pending browser pause release.

No specs, staticCollision, reference assets or forbidden directories were edited. No deployment or merge.

Pending browser commands (only after the explicit pause lift; release slots between batches):

```sh
npm run build
SCENE_SERVER=preview SCENE_PORT=34571 E2E_UNITS=2 npm run scene:catalog -- --matrix --filter 'vfx-hud-*' --backend webgl2 --out test-results/vfx-hud-polish/webgl2
SCENE_SERVER=preview SCENE_PORT=34572 E2E_UNITS=2 npm run scene:catalog -- --matrix --filter 'vfx-hud-*' --backend webgpu --out test-results/vfx-hud-polish/webgpu
E2E_PORT=34573 sh tools/e2e-lock.sh npx playwright test -c tools/scenelab/vfx-hud-polish.config.ts --workers=2 --retries=1
E2E_PORT=34574 sh tools/perf/quiet-run.sh npx playwright test tests/perf/e18-counters.spec.ts --project=chromium --workers=1
```

Remote E18 timing note: the combined sweep measured Alpha support high p95 **6.08 ms** and zoo S2 high **4.54 ms**, exceeding the unchanged 4 ms caps. Both failures reproduce with the original renderer source in an isolated remote job on another runner (**9.62 ms** and **12.44 ms** respectively under that runner's load). These are baseline timing failures, not a claimed E18 pass. See [base-perf.log](base-perf.log), [Alpha proof](base-alpha-200.json), and [zoo proof](base-zoo-200.json). Other timing checks, including the horde reference, passed; the combined sweep finished with those two timing failures only. The rerun with the existing two-slot timing-isolation wrapper passed Alpha support high at **2.51 ms**, but zoo S2 high still failed at **4.09 ms** against 4 ms (both low-tier cases passed). No sim source changes are part of this patch. The zoo budget remains unresolved; it is not waived. See [isolated-perf.log](isolated-perf.log), [Alpha proof](isolated-alpha-200.json), and [zoo proof](isolated-zoo-200.json).

## Handoff

Implementation and Node validation are complete. Browser work never started because the explicit pause was not lifted; the thirty-minute admission-wait boundary was reported to the orchestrator without acquiring slots. **New game-camera captures, opened/described after images, WebGL2/WebGPU quality/zoom execution, the HUD browser gate, native E18 counters/timing and browser epic verification remain unmeasured.** The before-image descriptions above are not after evidence. Do not treat this commit as visually approved or as a deploy-gate pass.
