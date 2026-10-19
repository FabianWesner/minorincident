# L6/L7 character readability and touch prompts

The courier now has a separate surface fill on its own materials. Within the shared L6-exit/L7 night preset, the old world-space capsule also lit nearby survivor meshes; the direct fill and extra smoke rim now apply only to the courier. Other presets retain their established aura and smoke behaviour, including driven vehicles. The courier reuses the existing foreground silhouette when L7’s close following crowd would cover its body. A distance-adjusted rim retains a visible edge at all player zooms. Palette colours remain intact: the fill uses the authored albedo, without whitening dark detail through a channel floor. The six night health-bar browser checks pass at desktop, portrait-phone and landscape-phone sizes on both backends (sampled minimum **3.355:1** between every pair of layers; see `bars/`). Night health bars use a dimmer outline/fill palette while retaining all three pairwise 3:1 contrast assertions, bar sizes and eligibility. The shared preset retains the batch 12 grade, haze, sky, practicals and ground aura.

The L6/L7 corgi uses continuous moon bounce and a restrained rim. Its coat keeps its authored colour outside the subway headlamp cone. This adds material arithmetic/uniforms within the existing pass; it adds no lights, meshes, textures or render passes.

The device prompt adapter maps interaction keys to the on-screen ACTION label on touch. The shared interaction caption, bicycle prompt, HUD mission/rescue/story text and MissionUI text use it. Existing onboarding, minigun and input hints already select touch wording. Unit cases cover gate close/brace, headlamp, barricade, rescue, bicycle, console and F/MMB instructions, preserving desktop text.

## Reproduce

```sh
npm run typecheck
npm run lint
npm run build
sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4
E2E_PORT=3851 E2E_UNITS=1 sh tools/e2e-lock.sh npx playwright test tests/visual/l7-night.spec.ts tests/visual/l6-companion.spec.ts --project=chromium --workers=1
SCENE_PORT=3852 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/atmosphere/readability.ts after webgl2
SCENE_PORT=3854 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/atmosphere/readability.ts after webgpu
SCENE_PORT=3853 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/atmosphere/readability-phone.ts
SCENE_PORT=3856 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/catalog.ts --matrix --jobs 1 --backend webgl2 --filter 'qa-w6-readability-*' --out docs/reports/readability-w6b/matrix/webgl2
SCENE_PORT=3857 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/catalog.ts --matrix --jobs 1 --backend webgpu --filter 'qa-w6-readability-*' --out docs/reports/readability-w6b/matrix/webgpu
```

The new scenes are `tests/scenes/catalog/qa-w6-readability-l6.json` and `qa-w6-readability-l7.json`; the existing `qa-w6-*` matrix catalog selector includes both.

The companion assertion uses its actual depth-tested silhouette and the visible samples of a sixteen-point 1.5 m ground ring (at least eight samples, at the actual terrain height). The fixture places it 2.97 m from the courier, outside the 2.6 m aura and the supply-crate pool. Campaign captures hide HUD panels so the ring measures the world. T-E29-14 keeps its existing silhouette/ring measurement, 200-pixel guard and 3:1 threshold, adding both backends and all three player zooms. The fixture snaps the normal follow camera after its long rocket-to-horde teleport so the second spot is actually in view; silhouette, ring coordinates, luminance math and thresholds are unchanged.

Baseline: saved production build from the initial clean checkout `2d5e0fb84`. With the final measurement at low quality, zoom 1 on WebGL, the L6 corgi is **0.769:1** and L7 **1.009:1**. Both fail the new 3:1 assertion. See `before/webgl2/index.json` and the matching game-camera captures.

## Validation and visual review

Opened the four campaign sheets in `after/` (every quality/zoom on both backends) and the four phone captures (`phone/review.jpg`). Compared with `../atmosphere-2`: L6 retains its orange supply-crate pool, teal-grey tunnel, deep dark recesses and sparse embers. The corgi is now orange/cream with a readable backpack outside the pool at all three zooms. L7 retains violet night shadows and warm ash/horizon; the courier has a deliberately bright pale silhouette, with the orange helmet/boots and teal parcel distinguishable. The crowded rocket entry still compresses clothing detail in the brightest highlights; the foreground treatment keeps the full body identifiable through companions. The change does not lift the world or remove the ruined-city mood. WebGL and WebGPU agree closely; low keeps the same character read with fewer background details.

The phone gate caption reads “Let everyone pass · ACTION to close the gate” in portrait and landscape on both backends. It wraps within its panel without clipping, and the on-screen ACTION control remains visible.

Typecheck, lint and production build pass. The final focused remote atmosphere/UI run also passed **24 tests** across 6 files. The first remote full unit/sim/levels run passed **3184 tests** (11 skipped); a later full unit run passed **1659** (9 skipped). A repeated full unit run encountered two host-load timeouts in the static and asset validators. The asset validator passed its isolated retry; the final remote render/UI/static retry passed **429 tests across 110 files**. Its static build also caught an out-of-scope tooltip variable during an earlier retry, which was corrected before the passing run.

`npm run verify -- E29` was executed: static checks and remote E29/smoke tests passed; browser checks were 45/54 on an earlier rendering iteration. Seven courier failures are covered by the final expanded regression below. The other two are unchanged `l7-pairs.spec.ts` fixture failures: it reads raw `D-FAIR.layout.json` pair anchors that only exist after the L5 layout derivation, and throws before rendering. No thresholds or performance budgets were changed. Full verify is therefore not claimed green.

## Final contrast results

All **14 browser tests pass**: the original T-E29-14 measurement at both rocket/horde spots × high/low × WebGL/WebGPU × zoom 0.5/1/1.5 (24 measurements), plus the two L6 companion assertions. The courier minimum is **3.053:1 high**, **3.068:1 low**. See [courier metrics](courier/index.json) and opened rocket/horde sheets. The far zoom uses a stronger rim; the close and normal zooms retain the softer fill.

The two new Scene Lab catalog scenes pass the full matrix on both backends: **24/24** quality/zoom rows, zero console errors or undrawn frames. Opened `matrix/*-review.jpg`: L6 keeps warm practical pools with dark tunnel separation; L7 remains a dark violet ruined street, with both characters standing apart from it. The follow camera retains the production obstruction clearance at close zoom.

Campaign capture contrast and performance counters are recorded in `after/{backend}/index.json`. These are actual backend assertions, not renderer requests alone. Resource gates retain 600 draws / 1.5M triangles high and 300 draws / 500k triangles low.

| Backend | L6 corgi minimum | L7 corgi minimum | Peak draws high/low | Peak triangles high/low |
| --- | ---: | ---: | ---: | ---: |
| webgl2 | 3.826:1 | 3.599:1 | 144/94 | 320196/130831 |
| webgpu | 3.828:1 | 3.604:1 | 144/94 | 320196/130831 |

## Performance

Final native timing is recorded below; `perf/before` holds the clean baseline comparison. Earlier native timing already showed both clean baseline L7 cases red: high frame p95 `16.700000000000728` vs 16.7 ms; low simulation p95 6.9 vs 6 ms (frame p95 33.3 ms). The first changed build also passed the E18 desktop horde test, but had L7 low frame/simulation p95 35.5/7.7 ms. These failures were retained; no rounding or budget edits were made.


Final native batch: **4/5 pass**, after a 26-minute admission wait; the reservation was released after 2.2 minutes. Headless native Metal WebGL2, one worker, all slots reserved through `quiet-run`. See `perf/final/run.log` and the raw JSON. Native WebGPU timing is not covered by these fixtures; WebGPU received the full visual/contrast/counter matrix.

| Case | Final frame p95 | Final sim p95 | Result |
| --- | ---: | ---: | --- |
| E18 desktop horde | 6.5 ms | — | pass (16.7 ms budget) |
| L6 high | 8.5 ms | — | pass (14 ms p95, 42.1 ms max) |
| L6 low, 4× CPU | 23.3 ms | — | pass (12.3 ms p50, 71.6 ms max) |
| L7 high | 15.2 ms | 2.1 ms | pass (16.7 / 4 ms) |
| L7 low, 4× CPU | **34.6 ms** | **7.5 ms** | **FAIL** (33.3 / 6 ms) |

**L7 low performance remains open.** Its clean baseline also fails simulation timing (6.9 ms), but final frame timing is 1.3 ms above that baseline and final simulation timing is 0.6 ms higher. These runs do not establish that this change is performance-neutral. The final draw/triangle/heap/VFX/light counters are within their unchanged E18 caps; see `perf/final/resource-checks.json`. No additional timing batch was chained onto the reservation. The full deployment gate is not green because of this low-tier timing result and the unchanged pairs fixture errors described above.

Opened the final native captures in `perf/final/`: the high L6 frame retains the warm track/headlamp pool with dark figures upstream; the low portrait frame keeps the lit courier and the rail route distinct against the deep tunnel. The E18 stress image contains the expected dense 200-infected cluster.
