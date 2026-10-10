# E26/E28 integration on current main

Baseline: `b6b7c2b0` (L3 squad follow/finale, current main at job start). Integrated `lane/e26` at `67eba92d` first, then `lane/e28` at `e25d292e`, on `lane/integrate-e26-e28`. Nothing was deployed or merged to main.

## Decisions and merge resolution

- E26 AC01 now distinguishes environment-prop mass bands from the dedicated E09 vehicle mass contracts. The existing tuned and PO-tested vehicle masses are retained. This corrects the criterion; no vehicles were retuned.
- E28 AC01 explicitly defers actual L5 aftermath and L6 night-exit fixture integration to E23/E24. E28 AC10 defers the L5 pair-plaza fixture to E23. Existing storm and particle budgets are unchanged.
- The Scene Lab effect dispatcher was the sole text conflict: it dispatches both barricade hits and weather lightning. Merge commits: `8390a039` (E26), `4bc4701a` (E28). The automatically merged L1 route, L3 squad/finale, L4, holster and police/firefighter systems remain in the integration.
- The assisted L1 photo route exposed a screen-click timing bug: the fixture switched back to follow before consuming its queued cinematic-camera click, sending the courier through the bay trigger. It now steps once before switching cameras, matching the existing L3 helper. Every mission and invitation assertion is retained.
- The supplementary E25 night-eye fixture put one AI-controlled infected with its back to the camera after warm-up, so the eye-color check sampled its blue hair rim. The fixture now places threats close together on open road southwest of the courier, outside the contrast ring, facing the game camera. An added assertion keeps all three sampled heads inside the viewport; the brightness, hue and player-contrast thresholds are unchanged. Both supplementary E25 lighting checks pass.
- The storm mood fixture originally captured only the bright scripted strike at frame 62. It now retains that flash image and also captures frame 120 after the flash decays; no lightning behavior is changed.
- Lighting uses existing Three node materials, instanced light-field footprints and depth-tested mesh cards. Golden haze gains three soft warm shafts; fog fill follows surface color; wet highlights vary along the ground instead of making uniform stripes; window pools clip at their source facade. No additional render pass, shadow map, dependency or renderer technology was introduced. The first paired run exposed >5% regressions; shared global uniform groups and runtime branches alone were insufficient against a fresh main control. Palette materials now cache node graphs for the active weather and lighting features, excluding dormant wet/snow/fog/diagnostic work from dry shaders. Residual wetness and accumulation select the corresponding graphs until they disappear. All effects remain active in their corresponding states. Frozen corpse materials keep their original shading uniforms and follow subsequent weather changes, even after their source material is disposed; a focused unit test covers graph caching, see-through wrapping and that disposal sequence.

## Validation

Final remote full unit: **120 files, 417 tests passed**. Initial full unit + E26/E28 sim: **121 files, 446 tests passed**. Final typecheck, lint and build pass. The required campaign/crowd suite is **21/21 green**; E26 verification is **31 browser checks green** and E28 verification is **48 browser checks green**, including all existing smoke cases.

Commands and final results are recorded below; final performance and capture checks follow the functional gates. All browsers are headless; Chromium uses native Metal. Weather/physics and paired performance use WebGL2. Runs use `tools/e2e-lock.sh` and private ports. Campaign, own browser checks, performance and Scene Lab use one worker; the smoke package retains its two-worker cap. The required regression suite also exercises its existing WebGPU cases; no manual WebGPU visual review is claimed. No long bot batteries, changed thresholds, disabled features, pushes or main merges.

### Commands and results

| Command | Result |
| --- | --- |
| `npm run typecheck`; `npm run lint`; `npm run build` | PASS |
| `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit --maxWorkers=4` | 120 files / 417 tests PASS |
| `E2E_PORT=3391 npm run -s test:smoke` (with `E2E_SLOTS=1` and the global lock) | 6 sim + 26 browser PASS after the final cache correction |
| `E2E_SLOTS=1 E2E_PORT=3391 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels tests/e2e/crowd-visible-outbreak.spec.ts --project=chromium --workers=1` | 21/21 PASS; all L3 routes finish with zero deaths |
| `MI_VERIFY_REMOTE_SIM=1 E2E_SLOTS=1 E2E_PORT=3395 npm run verify -- E26` | All stages PASS; 29 selected sim/smoke + 31 browser checks |
| `MI_VERIFY_REMOTE_SIM=1 E2E_SLOTS=1 E2E_PORT=3395 npm run verify -- E28` | All stages PASS; 15 selected sim/smoke + 48 browser checks |
| Locked, one-worker E26/E28 browser + visual + own stress tests, plus E25 hero-shadow and night readability | 29/29 PASS on the final renderer (24 weather/lighting + 5 barricade checks) |
| `E2E_SLOTS=1 SCENE_SERVER=preview SCENE_PORT=3409 npm run scene:catalog -- --filter 'weather-*,barricade-*' --jobs 1 --size 1280x720 --out test-results/integrate-e26-e28/catalog` | 11/11 PASS, zero console errors, all contact sheets inspected |

A final focused cache test exposed Three’s `NodeMaterial.copy` copying a TypeScript-private map by reference. The cache now uses Three’s underscored internal-property convention, retaining separate source/corpse caches. The test passes; full remote units, own weather/barricade checks and smoke are repeated after this cache-only correction. The 21-case campaign run and paired timings preceded that correction; surface graph math is unchanged. The last development catalog overlapped this edit and reloaded during the clear capture (10/11 passed); the replacement catalog serves the immutable preview build.

Raw logs and verifier checks: [validation evidence](../../test-results/integrate-e26-e28/validation/). The first campaign run had 20 passes and one assisted L1 capture failure; the camera-consumption fix above passed its targeted rerun and then the full 21-test suite. Verification builds and E26/E28 browser checks are serialized, preventing `dist` rebuilds underneath active captures.

## Campaign performance

Baseline and integration use the identical `tests/perf/integrate-e26-e28.spec.ts` against separately built sources. Native headless Chrome, unthrottled high at 1600×900/DPR1; phone low uses Pixel 7 at 390×844/native DPR with ×4 CPU throttle, render DPR1.5. Seed 28, real mission start, 120 fixed warm-up ticks, then 720 real-clock frames with the first 120 discarded. Gameplay follow camera; no bot completion pass. This measures the opening campaign fixtures, not every mission peak. Existing E18 structural and frame assertions remain in place. `quiet-run.sh` reserves both shared browser locks and requires Mac load <3 and no other headless Chrome; `E2E_SLOTS=1` throughout.

| Level | Tier | Main p95 ms | Integration p95 ms | Change |
| --- | --- | ---: | ---: | ---: |
| L1 | High | 12.6 | 12.1 | -3.97% |
| L1 | Phone | 34.5 | 34.7 | +0.58% |
| L2 | High | 14.0 | 13.0 | -7.14% |
| L2 | Phone | 34.8 | 34.0 | -2.30% |
| L3 | High | 13.7 | 13.5 | -1.46% |
| L3 | Phone | 34.9 | 34.6 | -0.86% |
| L4 | High | 12.9 | 12.8 | -0.78% |
| L4 | Phone | 17.9 | 17.3 | -3.35% |

**8/8 PASS:** all unchanged absolute budget assertions and the independent ≤5% p95 regression gate pass. High budgets are L1 ≤16.7 ms and L2–L4 ≤14 ms; the existing phone proxy asserts p50 ≤33.33 ms, while the regression gate compares p95. Raw 600-frame samples and conditions are retained in `test-results/integrate-e26-e28/perf/`.

The initial control, taken earlier on the shared Mac, exceeded the high budget in L2–L4 (15.2/14.7/14.5 ms). A fresh control on unchanged `b6b7c2b0` passed all budgets and exposed a real 15–19% high-tier regression in the pre-optimization renderer. That fresh control is the denominator above; it is retained unchanged. The final active-effect graph run fixes those regressions. Diagnostic iterations, including failures, are archived separately; no budgets or assertions were loosened.

## Visual review

Opened all eleven newly generated contact sheets at `test-results/integrate-e26-e28/catalog/`, plus full-size fog-player, golden-haze and wall-facing captures. Scene Lab: **11/11 pass**, zero console errors. The isolated fixtures deliberately expose lighting and actors without campaign dressing.

| Capture | Observation |
| --- | --- |
| Clear | Bright neutral ground, crisp purple shadows, saturated red car and visible courier/infected. |
| Overcast | Lower light and muted ground; softer shadows distinguish it from clear. |
| Golden haze | Warm amber ground, long purple shadows and three soft diagonal sun shafts. The shafts cross the street without hiding actor silhouettes. |
| Thunderstorm | Dark blue street, dense cool rain, warm window/lamp pools and wet highlights; the courier and threat remain identifiable. Separate lightning/blackout checks pass. |
| Fog | Blue ground haze and warm practical light; courier teal cap, tan clothing and gray shoes retain color. Measured player/ring contrast **3.077:1**, 7,585 player pixels. |
| Snow | Cold blue surroundings, dense light flakes, pale upward-facing surface accumulation and visible tracks; warm windows and the lamp separate it from the dark ground. Roof/car mask coverage and track-growth assertions pass. |
| Ash | Violet dusk, sparser gray flakes, subdued car/ground colors and warm practicals distinguish ash from snow. |
| Rain | Fine streaks over dim neutral ground and wet surface highlights; actors remain unobscured. |
| Wind | Sparse pale streaks, clear daytime actors; the separately captured smoke column bends along the weather wind. |
| Barricade W0 | Coverage and brace-progress bars are distinct; 95% coverage, completed plank overlay, damage and released bench are visible in sequence. |
| Barricade W5 | The same controls and plank states remain readable against purple darkness, with long colored shadows. |

Full-size evidence is in `test-results/integrate-e26-e28/visual/`. The wall-facing capture shows warm window spill outside the visible facade and a dark, colored building shadow beyond its left corner; the final E25 hero-shadow capture shows a purple shadow, measured 74.6% darker than adjacent lit ground (hue 277°), with one shadow map. The night street courier retains clothing colors at 3.140:1 ring contrast, and all three threats remain in frame with bright red/pink eyes. Wet highlights remain stylized, and snow tracks are intentionally coarse at this game-camera scale.


### E28 AC12 / vision checklist G

Integration review supersedes the lane's failed lighting review. Compared against `initial-drafts/weather-and-time-of-day-moods.png`; `assets/_keyframes/lighting/` does not exist in either this worktree or current main, so no inspection of those missing keyframes is claimed.

| Priority | Item | Result and observed evidence |
| --- | --- | --- |
| Must | Source glow and visible spill | PASS: windows and street lamp glow, with warm outward pools in fog, snow and sustained storm. |
| Must | Geometry and shadow occlusion | PASS: the added wall-facing capture shows exterior window spill bounded by the facade and a dark colored building shadow; the E25 hero shadow interrupts a practical pool, with its unchanged numeric check passing. |
| Must | Colored, appropriate shadows | PASS: purple daytime shadows lengthen in haze, soften under overcast, and remain colored at night (hero-shadow hue 277°). |
| Must | Night player/threat readability | PASS: courier and infected silhouettes read in storm/fog/snow; fog contrast is 3.077:1 and campaign night contrast 3.140:1, with all three sampled heads inside the viewport. |
| Should | Beams, lit haze and glints | PASS: three soft warm haze shafts cross the street; practical pools light fog while the courier retains clothing colors. |
| Should | Appropriate reflections | PASS: wet ground has broken lit streaks and dry ground lacks them; reflections are intentionally stylized rather than mirror images. |
| Should | Script mood | PASS: amber haze, blue fog/snow, dark rainy storm, neutral clear and muted overcast are distinct in the game-camera captures. |

Every Must (4/4) and every Should (3/3) passes. Snow footprints remain coarse, and the overcast change is restrained; neither obscures actors or the intended weather state. L5/L6 campaign fixtures remain explicitly deferred to E23/E24, while L1–L4 performance and the existing E26/E28 Scene Lab fixtures are covered here.

## Delivery

Both lanes are merged only into `lane/integrate-e26-e28`. Selected full-size captures, all eleven contact sheets, metrics, raw paired frame samples and validation logs are committed under `test-results/integrate-e26-e28/`; 92 other generated captures were deleted and the temporary pristine-main archive removed. The lanes’ original committed evidence was restored. No budgets/assertions were reduced, no features disabled, and protected reference/art sources were unchanged.
