# Infected bodies and eyes

The renderer preserves thin infected body surfaces, keeps dark clothing continuous at night, and renders eye cores as red emitters. Final eye probes reach a minimum red margin of **91**, above the unchanged **60** gate.

Source baseline: `c31833b25` (the job's own `night-bodies-eyes` worktree). Gameplay stats, Alpha balance, L5 difficulty, global bloom and the existing 60-point eye margin are unchanged.

## Findings and changes

The atmosphere lane's [recorded probe](../atmosphere/eye-probe/measurements.json) has 51/55/57 night margins at bloom .25. On this checkout a fresh production build reproduced the broken-looking bodies but measured 106/110/112 with that same moving-actor probe; this is not a paired comparison against atmosphere's build. The new baseline is saved under `baseline/`.

The frozen `night-street` [diagnostic](diagnostic/) preserves the same figures while successively enabling double-sided surfaces, removing the mask, removing shadow reception and replacing the palette output with neutral Lambert shading. The first three changes leave the visible breakup; neutral shading exposes continuous torsos, arms and legs. Source LOD triangle/joint checks found positive joint determinants. Dark clothing disappears into the road between brighter faceted seams; the crowd moon fill now has a .12 linear albedo floor, gated by the existing per-figure fill and night rim. Daylight and world surfaces do not receive this floor.

Close low-tier captures then exposed a second cause: runtime simplification erased thin limb/clothing shells even though bounds and eye locks survived. Position tolerance alone did not preserve those surfaces. The infected runtime simplifier now retains an authored rig part whenever simplification would remove more than 15% of its surface area. This runs only during baking and adds no draws. The new real-asset retention test failed all seven old low-tier bakes and passes with the guard; the existing geometry-reduction test still passes.

The eye path also had two distinct problems. Normalized emissive swatches still received ordinary surface/bounce/rim light, and imported white eye cores/glints were classified with ordinary white materials. The renderer now excludes surface lighting on the merged eye vertices and uses a bounded red emitter. `markInfectedEyeCores` includes white cores inside each existing eye envelope before simplification, preserving teeth and skin and locking the cores in the low LOD. The focused regression checks all seven ordinary infected models at LOD1 and LOD2, including core retention after low-tier simplification.

## Evidence and validation

The existing `T-E25-13` brightest-body night test is unchanged. The expanded probe projects actual emitted eye geometry, because the original body-sized crop selects blonde hair in daylight. It rasterizes the projected emitted triangles rather than a rectangle that can include bright skin between the eyes. Its frozen actors remain inside the close camera and use short hair to isolate color from brim occlusion. The catalog fixtures exercise all seven production models with their normal accessory choices, both quality tiers and all three player zooms. New scenes are included in both matrix script filters.

The baseline bloom sweep keeps its measurements and the .25 frame.

Passed: production build, typecheck, lint and the 16 focused geometry/LOD checks (763 ms, four-worker cap). The unchanged night test passes all four backend/tier configurations. Both final eye probes pass all 12 rows (72 eye samples total across backends; minimum red margin 91). The native E18 probes pass on ANGLE/Metal (Apple M4): high horde p95 **6.1 ms**, **640,297 triangles / 71 draws** with 200 infected; throttled low p95 **12.0 ms**, **266,796 triangles / 69 draws** with 100 infected. Both include 40 live civilians. The separate desktop reference probe passes at **5.8 ms**. The upstream WebGPU-only manual case remains skipped; actual WebGPU scene/eye matrices pass. [Native evidence](validation/e18-native.txt).

The full runner batch completed **3,171 tests: 3,140 passed, 22 failed, nine skipped**. Fourteen failures were simulation timing limits on the shared host; the complete timing project passes **206/206** under `tools/remote/timing-isolated.sh`, with unchanged limits. The other eight exposed civilian shipped-bake parity: applying the new retention guard to their deterministic preparation changed the bytes. Retention is now explicit for infected runtime bakes; civilian preparation keeps its shipped reduction. A final remote follow-up passes **92/92**, covering every civilian bake, Alpha geometry, eye cores and LOD geometry. All level tests, including the L5 balance fixture and continuous campaigns, passed. No full local Vitest suite was run. [Full run](validation/full-suites.txt), [failures](validation/full-suite-failures.json), [isolated timing](validation/timing-isolated.txt), [final follow-up](validation/final-followup.txt).

The E25 verifier passes: typecheck, lint, build, 50 filtered Node tests, 49 browser cases (two existing skips), and all four native performance cases. That run preceded the final civilian compatibility scope fix, which leaves the tested infected renderer and shipped civilian geometry unchanged. Typecheck, lint, build and all 92 affected Node tests pass again after that final change; final eye/catalog captures use the fresh build. [Verifier checks](validation/verify-e25-checks.json), [full log](validation/verify-e25-final.txt).

## Opened vision review

Opened all final catalog sheets through the four [backend/tier review sheets](matrix/), plus both [day/night eye-probe reviews](after/). Every catalog row contains frames 0/15/30; the compact isometric arrangement keeps all seven infected bodies inside the closest camera. At .5, jackets, legs, forearms, fingers and shoes form connected silhouettes; low retains visibly coarser authored facets but no erased limb shells. At 1 and 1.5, the complete silhouettes remain coherent through the idle/attack poses. Frame 30 has normal red melee telegraphs on the floor. Some production headwear occludes faces, which is why the color-only eye fixture uses short hair. WebGL2 and WebGPU show the same body read.

Opened the [paired close-zoom control](comparison-close.jpg), built from the original `c31833b25` product code and the final renderer at identical camera/actor poses. The old low-tier frame loses hand/garment surfaces (even the spatula becomes floating slivers); the corrected frame retains them. Dark high-tier jackets now separate from the night road. In the original high/day close frame, eye margins are **50/51/39**; the corrected frame is **119/118/115**. The final eye centers remain red in daylight and night without the original pale glare. Raw lossless frames and measurements are under `before/webgl2/` and `after/<backend>/`.

## E25 window-probe repair

The broad E25 run found a pre-existing window probe failure: it returned **0/200** samples because it checked only `isInstancedMesh`, which the renderer disables for explicit instance attributes. The original commit reproduces the same failure. Accepting its existing `staticInstanceAttributes` marker repairs the probe; the unmodified baseline product then passes. The **200 samples**, **≥4 px parallax** and **>4× on/off glow** assertions are unchanged. Baseline measurements are **69.60 px** and **9.75×**. [Original failure](validation/window-baseline.txt), [baseline with repaired selector](validation/window-baseline-fixed.txt), [pixel measurements](validation/window-baseline-surfaces.json). No specification was changed.

## Reproduce

After `npm run build`, use unique ports and the shared wrappers:

```sh
SCENE_SERVER=preview SCENE_PORT=3477 sh tools/e2e-lock.sh npx tsx tools/atmosphere/body-eye-probe.ts webgl2
SCENE_SERVER=preview SCENE_PORT=3479 sh tools/e2e-lock.sh npx tsx tools/atmosphere/body-eye-probe.ts webgpu
SCENE_SERVER=preview SCENE_PORT=3481 E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/catalog.ts --matrix --jobs 1 --backend webgl2 --filter 'night-bodies-eyes-*' --out docs/reports/night-bodies-eyes/matrix/webgl2
# Repeat the catalog on webgpu with a separate port/output.
E2E_PORT=3478 E2E_UNITS=1 sh tools/e2e-lock.sh npx playwright test tests/visual/e25-lighting.spec.ts --project=chromium --workers=1 --grep T-E25-13
E2E_PORT=3485 sh tools/perf/quiet-run.sh npx playwright test tests/perf/e18-desktop.spec.ts tests/perf/horde-budget.spec.ts --project=chromium --workers=1
sh tools/remote/run.sh "$PWD" --pull test-results/night-bodies-suites.json -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4 --reporter=default --reporter=json --outputFile=test-results/night-bodies-suites.json
sh tools/remote/run.sh "$PWD" --pull test-results/night-bodies-timing-all.json -- bash tools/remote/timing-isolated.sh npx vitest run tests/unit tests/sim tests/levels --project=timing --maxWorkers=1 --reporter=default --reporter=json --outputFile=test-results/night-bodies-timing-all.json
MI_VERIFY_REMOTE_SIM=1 E2E_PORT=3487 E2E_UNITS=1 npm run verify -- E25
```

Probe sheets label zoom .5/1/1.5 as f50/f100/f150. Shared-host still counters are not native timing evidence. Quiet-run reservations remain bounded to 20 minutes and browser admission to 30 minutes.
