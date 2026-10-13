# WebGPU blank canvas at zoom 1.0

The health-bar pass overwrote the game image on WebGPU. This reproduces in real L1, L4 and L8, high and low, when an Alpha's bar is on screen. Initial views without bars were non-blank. At zoom 0.5 the test Alpha/Mega bar is cropped out and the original renderer appears healthy. The bar is GPU geometry, despite the earlier report calling it a DOM bar.

Baseline: `a2753b00` (this lane's starting main). The affected `renderBars()` and `Renderer.ts` are identical on production `fa96264b`. The issue originates in the pooled health-bar implementation (`aaaa3ad6`). The zoom cap (`de5a9778`, `[.5, 1]`), today's safe-pull/scripted-camera change (`5956a43f`), and LightField/WeatherView dispose-on-resize fix (`fa672441`) were inspected. They do not cause the overwrite: the same camera, textures and scene become visible by correcting only the overlay's sample count.

Three r186's `Renderer.currentSamples` returns zero for the RenderPipeline fullscreen quad. That quad writes directly to the single-sample canvas. The following health-bar scene, with output conversion disabled and ordinary scene rendering, uses four samples. WebGPU loads its separate MSAA colour buffer and resolves that buffer over the canvas; `autoClear=false` cannot preserve an image in a different buffer. The fix scopes `currentSamples=0` to `renderOverlay()` at the canvas target and restores the flag in `finally`. World/HDR target antialiasing, WebGPU selection, postprocessing and health bars stay active.

The shared canvas gate copies the actual presented canvas into a 2D readback immediately after `screenshotReady()`, then measures RGB variance. DOM HUD, labels and contact-sheet captions cannot contribute pixels. It requires global variance >1 and at least 8 of 64 tiles with channel variance >1; spatial coverage rejects a blank background with one health bar even though that bar creates nonzero global variance. It runs at every Scene Lab capture stop and the final frame, including runs without screenshots, and in foundation/WebGPU smoke. Requested backend must match the rendered backend. Existing numeric criteria and thresholds are preserved.

The new gate on the original implementation rejected both mega-slam zoom-1 rows (1–2 varied tiles), while both zoom-0.5 rows passed. The same four rows pass after the fix. Original real-game zoom-1 captures with a visible Alpha likewise have only two varied tiles at both tiers; all twelve fixed captures pass. [summary.json](summary.json) retains per-frame minima, real-game camera state, bar counts and backend evidence. [Broken mega](broken-mega.jpg), [fixed mega](fixed-mega.jpg), [broken L1 game](broken-game.png).

All twelve game PNGs were opened individually before retaining JPEG copies below. These use the actual follow/driving camera, a real level, seed 1, native headless WebGPU and physical wheel events to reach zoom 0.5. An Alpha is added near the player to exercise the overlay before a natural encounter. At zoom 1 every level asserts a visible bar, and both zooms assert the actual camera ratio.

| Capture | Opened visual observation |
| --- | --- |
| [L1 high 1](game/L1-high-z1.jpg) | Courier, corgi, café, bench, pavement and road shadows visible; Alpha and white/red bar above. |
| [L1 high .5](game/L1-high-z0.5.jpg) | Close courier and corgi, pavement joints, road paint and shadow visible; Alpha cropped at top. |
| [L1 low 1](game/L1-low-z1.jpg) | Same street, courier/corgi, bench and Alpha bar remain visible with simpler figures and shadows. |
| [L1 low .5](game/L1-low-z0.5.jpg) | Close courier/corgi silhouettes, bench, pavement and road remain distinct. |
| [L4 high 1](game/L4-high-z1.jpg) | EVAC bus fills the driving frame; convoy trucks, army, barriers, crosswalk, headlights and bar visible. |
| [L4 high .5](game/L4-high-z0.5.jpg) | Close bus panels, tyres, red tail lamps, sidewalk and nearby civilians; normal tight driving crop. |
| [L4 low 1](game/L4-low-z1.jpg) | EVAC bus and convoy, fence, soldiers/civilians, shadows and Alpha bar visible. |
| [L4 low .5](game/L4-low-z0.5.jpg) | Close bus lettering, wheels, lamps, paving and civilian silhouettes visible. |
| [L8 high 1](game/L8-high-z1.jpg) | Night road, lit courier with bat, Alpha/bar, civilian group, bus lights, bench and cones visible. |
| [L8 high .5](game/L8-high-z0.5.jpg) | Close courier, bat and shoes over dark road with warm light pool; figures and cyan tell cropped above. |
| [L8 low 1](game/L8-low-z1.jpg) | Night courier, Alpha/bar, civilian silhouettes, bus headlights and warm road lighting visible. |
| [L8 low .5](game/L8-low-z0.5.jpg) | Close courier/bat, road surface, warm light pool and upper-frame figures visible. |

Mega move fixtures in `tests/scenes/l10-mega-moves/` cover charge, slam and grab, with/without a blocking wall, at both tiers and zooms: 24/24 pass. Catalog `inf-mega-*` covers lineup, arrival and pursuit: 12/12 pass. Opened sheets show the red-backed, white-spined boss, glowing eyes, courier, planted shadows, cyan/yellow tells, container/wall cover and pursuit. Zoom .5 deliberately crops the oversized boss; the actual rendered world stays present. [Low lineup](lineup-low.jpg).

Reproduction commands (all browser commands headless and locked):

```sh
npm run build
E2E_PORT=3498 sh tools/e2e-lock.sh npx playwright test tests/e2e/webgpu-canvas.spec.ts --project=chromium --workers=1
SCENE_PORT=3499 E2E_UNITS=1 npm run scene:catalog -- --dir tests/scenes/l10-mega-moves --matrix --backend webgpu --jobs 1
SCENE_PORT=3499 E2E_UNITS=1 npm run scene:catalog -- --matrix --backend webgpu --filter 'inf-mega-*' --jobs 1
SCENE_PORT=3499 E2E_UNITS=1 npm run scene:matrix -- --jobs 1
MI_VERIFY_REMOTE_SIM=1 E2E_PORT=3500 SCENE_PORT=3500 SCENE_SERVER=preview npm run verify -- E02
E2E_PORT=3498 SCENE_PORT=3498 SCENE_SERVER=preview npm run test:smoke
```

Validation completion is recorded in `summary.json`. Full unit suite ran on Hetzner: 1,311 passed, 7 skipped, zero failures. Typecheck, lint and build pass. `npm run test:smoke` passes all six selected simulation tests and all 31 browser tests, including the four native WebGPU canvas tests; zero skips or browser failures. The full Scene Lab matrix passes 108/108; its lowest sampled spatial coverage is 26/64 tiles. WebGL health-bar suites passed at desktop/portrait/landscape and 200/100-actor budgets.

`verify -- E02` ran with its simulation selection on Hetzner and browser selection on the Mac: 52 browser tests pass, six fail. All six failures were reproduced on a separate pristine checkout of `a2753b00`: `T-E02-05b` palette eligibility, `T-E02-perf` unloaded geometry count (11 versus 1), `T-E02-06` shadow hue, `T-E02-09` day/night hue delta, `T-E02-11` lookdev golden mismatch and `T-E02-fog` fog colour. Those tests use lookdev without health bars; the new overlay path is not invoked. Their thresholds and goldens were preserved. The isolated baseline command was `E2E_PORT=3501 sh tools/e2e-lock.sh npx playwright test tests/e2e/camera.spec.ts tests/perf/lookdev.spec.ts tests/visual/lookdev.spec.ts --project=chromium --workers=1 --grep 'T-E02-05b|T-E02-perf|T-E02-06|T-E02-09|T-E02-11|T-E02-fog'` after building that checkout.

The initial Mac capture batch briefly encountered missing static/model files while another verification build replaced `dist`; a stable-build rerun of the high-tier game gate passed. A remote full smoke attempt timed out in the pre-existing real-input L1 test under software rendering and was stopped; the required complete smoke run uses native Metal on the Mac (only six selected simulation smoke tests run locally, with full heavy unit/E02 simulation work on Hetzner). No deployment or merge.
