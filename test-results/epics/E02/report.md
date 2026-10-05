# E02 — Rendering, Camera and Visual Style

Completed 2026-10-05 on `lane/e02-epic`. All 12 acceptance criteria pass. Latest local main `2ffb7b7ea6ae5400bae665b9feaad1e4556fd5ad` was merged (already up to date); every required check was re-run afterward. Nothing was pushed or deployed.

## Built

WebGPU renderer with automatic WebGL2 fallback and explicit forced-WebGL selection; narrow-FOV follow camera with simulation-time smoothing, aspect adaptation, bounded shake, named photo spots and cinematic blending; shared palette texture and TSL PaletteMaterial with core shading, captured tinted drop shadows, hemisphere fill, terrain bounce and explicit shader fog; fitted sun shadows and L1–L6/golden moods; normalized HDR emissives, bloom and optional edge-only tilt-shift; nested-transform instancing; building fade, roof cutaways and survivor silhouette preservation. Lookdev uses code placeholders for two houses, a street, car, fences, lamps, rounded foliage/flowers, a survivor and five static infected.

Adaptations are attributed to Bruno Simon folio-2025 commit 41046b5 in headers and THIRD_PARTY_NOTICES.md. No dependencies or reference art/assets were imported. CompileAsync and two rendered frames replace the reference cube pre-render; real-time day cycles are adapted into scripted level presets. The existing empty scenario and headless simulation remain available.

The additive test surface exposes `getState().render` (backend, camera, lighting, material inventory, occlusion, probes), `perf().backend`, camera shake/cinematic/world projection, and render settings for cameraShake/bloom/cheapDof/timeOfDay. ID-pass and occluder visibility are test probes. Persistence, gameplay infected, district content and VFX remain later-epic responsibilities.

## Checks

| Command | Exit | Evidence |
| --- | --- | --- |
| npm run typecheck | 0 | checks.json; logs/verify.txt |
| npm run lint | 0 | checks.json; logs/verify.txt |
| npm run build | 0 | checks.json; logs/verify.txt |
| npm run test:unit | 0 | logs/test-unit.txt: 16 passed, one optional preview test skipped because preview/ is untracked and absent in this lane |
| E2E_PORT=3311 npm run test:smoke | 0 | logs/test-smoke.txt: 1 selected sim test and 12 browser tests passed across Chromium, portrait/landscape Android/iPhone, WebKit |
| E2E_PORT=3311 npm run verify -- E02 | 0 | checks.json, vitest.json (6 selected tests passed), playwright.json (26 passed) |
| E2E_PORT=3311 npm run verify -- E01 | 0 | logs/regression-E01.txt: 15 selected unit/sim tests, 19 browser tests passed |
| E2E_PORT=3311 npm run test:e2e:webgpu | 0 | logs/webgpu.txt, webgpu.json: 1 headed native-adapter test passed |

No final failures, retries, console errors or new static/build warnings. Non-selected tests are intentionally filtered by verify. The E01 warning guard checks stdout and stderr. The earlier E01 performance-counter failure was fixed by disabling Three's automatic info reset: Game owns RAF and resets once per rendered frame. A two-paused-frame regression assertion now proves counters persist.

## Acceptance evidence

| Criterion | Result | Passing test/evidence |
| --- | --- | --- |
| E02-AC01 | PASS | T-E02-01; T-E02-01b; backend.json, webgpu.png |
| E02-AC02 | PASS | T-E02-02; camera.json, player-height-mask.png |
| E02-AC03 | PASS | T-E02-03; follow.json |
| E02-AC04 | PASS | T-E02-04; camera.spec.ts: all 360 circle points at 390×844 |
| E02-AC05 | PASS | T-E02-05; T-E02-05b; palette.test.ts, runtime material instanceof inventory |
| E02-AC06 | PASS | T-E02-06; shadow.json, shadow-probe.png |
| E02-AC07 | PASS | T-E02-07; bloom.json, bloom-on.png, bloom-off.png |
| E02-AC08 | PASS | T-E02-08; occlusion.json, ID masks, occlusion-inside.png; 18-tick deadline assertion |
| E02-AC09 | PASS | T-E02-09; T-E02-fog; time-of-day.json, L1/L4/L6.png, fog.json, fog-far.png |
| E02-AC10 | PASS | T-E02-10; golden.png, review.md, compare/north-star.png |
| E02-AC11 | PASS | T-E02-11; visual-diff.json; three reviewed goldens |
| E02-AC12 | PASS | T-E02-12; view.test.ts: bounds and immediate disabled-setting clearing |

## Measured results and performance

- Complete survivor silhouette: 84 / 900 px = 0.09333 of viewport height. FOV 25°, azimuth π/4, polar 0.30π, follow radius 35 m.
- Teleport convergence after one sim second: focus x=19.99909200 m for target x=20 m; maximum x=19.99909200, no overshoot.
- Shadow probe: RGB [73, 52, 86], hue 277.06°, HSL lightness 27.06%.
- Bloom: 8 px-wide ring outside the clipped lamp silhouette: mean luminance on 187.648, off 88.681; ratio 2.116× (requirement ≥1.10×).
- Occluded survivor: 2398 visible category pixels / 2398 unobstructed pixels = 100.0%. The deadline test asserts opacity ≤0.35 after 18 ticks and roof hiding inside.
- L1/L4/L6 mean luminance: 116.442 / 83.197 / 47.300; corresponding mean-RGB hues 59.59° / 46.29° / 139.10°.
- Screenshot diff fractions (threshold 0.1): overview 0.0000%, street 0.6468%, shadow-probe 0.2793%; all ≤1.5%.
- Lookdev including shadow/post-processing passes: 182 draw calls, 62,433 triangles, 90 geometries, 18 textures. Below E18 high counters (600 calls / 1.5M triangles) and this fixture's tighter regression guards (250 / 150k).
- Three load/unload cycles return to 1 geometry and 2 textures each time. Paused calls remain 182 → 182 after two RAFs.
- CPU step/render submission median 0.100 ms, p95 2.900 ms. GPU completion is excluded. Paused SwiftShader capture RAF intervals are not a hardware FPS benchmark; hardware horde/frame budgets belong to E18. Native WebGPU rendering was independently verified.

## Deviations and known issues

No acceptance criteria were changed or weakened; specs changes only record E02 status. No new dependencies. No correctness issues remain within E02 scope.

Vision checklist A passes all four must items and 3/4 should items (75%). A8 (comparable clutter density) fails: the placeholder fixture is simpler than the concept art. Follow-up task for E10/E17: populate authored district streets with varied shop signage and loose clutter. This optional item does not change the ≥70% pass rule. Five infected are static render placeholders, not AI entities. SwiftShader is slow and some filtered-shadow edge pixels vary within the prescribed 1.5% tolerance; these measurements make no desktop FPS claim.

Final whole-diff review retained the existing architecture, removed redundant paused rendering and optional DOF work from the default output graph, and verified full resource cleanup. The source, tests, goldens, review and this report are committed in logical slices.
