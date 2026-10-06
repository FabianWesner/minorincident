# M1-27 / M1-28 rendering follow-up

Branch: `lane/m1-render-fix`, base `1292268`. Main was merged once before implementation. Changes are restricted to rendering and regression checks; survivor geometry, AI, lighting colours/intensity, shadow bias and normal bias remain unchanged.

## Causes and changes

Character blood used `fract(sin(dot(positionGeometry, large constants)) * 43758.5453) < bloodCoverage`, independently colouring fragments red. The shared character material applied this noise to skin, hair and clothing. `PaletteMaterial` now uses three smooth elliptical surface masks in each animated part's local coordinates. Existing coverage accumulation and gore-Off reset still control the splats.

Shadow-filter inspection also found that Three r186's default PCF rotates five samples using per-pixel interleaved gradient noise. Without temporal accumulation this produces penumbra stipple, visible around the actors in the original-renderer capture. The diner survivor metric specifically isolates the blood defect; it does not establish a separate shadow contribution to high-contrast isolated dots. `Lighting` supplies a stable symmetric weighted nine-tap PCF kernel. The existing shadow radius, resolution budgets, bias, normal bias and lighting grade are retained. This filter change was surfaced to the coordinating lighting lane.

`CrowdView` put living actors and corpses into transparent instanced batches. Three sorts meshes, not individual crowd instances; partial-alpha fragments blended corpse colours over the survivor and could retain depth while fading. Crowd surfaces now use opaque depth-tested, depth-writing materials. The existing corpse opacity is converted to a coherent 4×4 screen-door mask shared by all surfaces at each screen pixel, avoiding both transparent batch sorting and a 3D alpha hash revealing deeper body parts. Living actors retain every pixel. Discarded corpse pixels do not write depth.

`GibPool` already uses opaque depth-tested, depth-writing meshes and expires by hiding instances, without an alpha fade. It required no material change. Hit flashes are uniform emissive pulses, rather than a patterned mask. Ground decals remain separate from character blood.

## Regression evidence

`tests/e2e/m1-render.spec.ts` runs against the production build on port 3346 in headless Chromium/ANGLE Metal, through `tools/e2e-lock.sh`. The diner test starts through the menu, triggers the authored outbreak, fights its infected with real mouse attacks and zooms using the wheel. Teleporting only shortcuts the walk to the diner. It requires four kills, visible blood splats and ground decals, then measures isolated high-contrast dots against all eight neighbouring pixels in an eroded survivor ID mask with gore enabled and disabled. Diagonal authored eyes and straps therefore remain edges rather than false dot detections. Quality is fixed to high so automatic quality changes cannot alter the comparison.

The depth test kills a runner through combat and places the corpse behind/in front of the survivor at corpse ages 180, 1800, 1860 and 1919 ticks. Same-age reference frames account for idle animation. It checks upper-body occlusion, opaque colour preservation at half fade, and release of the silhouette at fade completion. Screenshots and machine-readable measurements are under `test-results/m1-render-fix/`.

The supplied feedback PNG contains a pre-combat backyard without corpses, so the tests capture fresh diner-combat evidence.

Both regressions fail with the three original renderer files from base `1292268`, then pass after restoring the fix and rebuilding production. Survivor isolated-dot ratio falls from 384/8215 (4.674%) to 97/8215 (1.181%). Blood adds 0.134 percentage points over gore Off, while 408 visibly changed survivor pixels preserve readable splats. The diner combat produces four kills and 125 ground decals; wheel zoom is 0.92774.

At half fade, front-corpse mixed colours fall from 4933/5548 (88.915%) to 11/5534 (0.199%). The solid behind corpse changes zero survivor pixels; the front corpse correctly covers feet. Age 1919 changes zero survivor pixels from either side.

Typecheck, lint and production build pass. Unit: 56 files / 150 tests pass. Smoke: three Vitest tests and all 22 headless browser checks pass. Focused render: both tests pass in 48.8 seconds. Complete pixel measurements, baseline samples and paths are recorded in the adjacent JSON report. Implementation commit: `cf1f451`.

## Baseline E19 failures

`npm run verify -- E19` stopped in Vitest: 32 passed, two failed. Both failures are inherited navigation tests, with unchanged simulation/world/collision code in this branch. The orchestrator explicitly requested recording these as baseline and leaving navigation outside this lane:

- M1-08 gas forecourt reachability: 2.5820746 m remaining versus 0.15 m required.
- M1-07 click navigation around a hedge: 4.2076876 m remaining versus 0.15 m required.

These failures prevent a full green E19 result; the dedicated render regressions are executed separately.
