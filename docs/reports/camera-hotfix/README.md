# Camera hotfix — PO L4 refuge-door-7

At player `(-56.23, 32.11)`, the follow ray intersects `bld.cafe-corner:7` about 5.30 m from the focus. `View.clearLens()` contracted the horizontal offset to stop before that facade, then raised the camera to maintain the 9.5 m minimum radius. Every wheel zoom hit the same contraction again. The camera's reported zoom/polar described the requested rig, hiding the actual 29.36° polar error at the reported spot.

Removed facade clearance from the follow camera and its district-volume registration. The see-through/silhouette presentation owns occluding walls. Player zoom now controls the full offset at the normal 54° polar angle; authored cinematics, story pulls, and vehicle framing retain their existing behavior. Removed the obsolete convoy clearance flag and updated the atmosphere capture tool that saved it.

Keeping the requested pose can put the lens inside an apartment or beside a large facade. A follow-up rendering fix marks only that occluding building placement for foreground clearance: the lens must be inside its oriented volume, or within 8 m with a projected bounding rectangle covering at least two thirds of the viewport (including near-plane crossings). Only fragments in front of the subject and above its support surface clear. Geometry behind the subject, unrelated placements and ordinary 35%-retained bounded see-through discs stay intact. The mode travels through the existing per-instance attribute and LOD changes; no additional vertex buffer or draw is introduced. Existing blank-viewport checks retain their thresholds. New cellar and Lakeshore Scene Lab scenes cover these cases at all three zooms.

The L1–L10 sweep visits mission waypoints, every authored street polyline (including alternative branches), the L9 detours, and every L10 regional/detour route, at all three zooms. A separate assertion begins at the exact reported L4 spot. The narrow-street unit tests now require the requested radius/polar through occluding facade volumes, including the cellar exit and moved Lakeshore apartment. They explicitly prove that the wall intersects the lens ray; their old requirement to contract outside every building is superseded by see-through. Legacy facade inputs remain in the regression fixtures so restoring the old camera code reproduces the failure.

The debug corpse counter included recoverable infected because their animation state is `dead`; its downed counter incorrectly required positive HP. The counters now classify zero-HP bodies using `recoverAt`, including deaths before the next AI update. A simulated explosive death survives pool reuse and ten minutes, while a melee knockdown rises and moves from downed to alive without changing permanent corpse count. The existing high/low L4 battlefield lifecycle tests also retain their permanent-body assertions. Thus a displayed decrease such as 73 → 55 can reflect recoveries rather than removed permanent bodies; the original shot has no entity-ID trace to attribute each of the 18 changes individually.

Moved the debug keyboard hint to a wrapping bottom strip. Controls and Sound sit below the vitals/companion HUD, with bounded scrolling for expanded panels. Browser regression covers 1280×720, 1920×1080, and 2000×990.

## Regression and capture commands

- CPU suites: `sh tools/remote/run.sh "$PWD" -- npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4`.
- Main-code negative control: run the final L1–L10 sweep on Hetzner with the original `View.ts` restored only in that private runner job. L4 fails specifically at the reported refuge-door-7 position; L5/L7 fail too. L1/L2/L3/L6/L8/L9/L10 pass.
- Focused green: remote `view.test.ts`, `infected-recover.test.ts`, and `camera-route-framing.test.ts` — 25/25 pass.
- Real L4 hide / line-break: `E2E_PORT=3419 E2E_UNITS=1 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/camera-hotfix.spec.ts --project=chromium --workers=1`.
- Scene Lab: unique `SCENE_PORT=3417` / `3418`, `SCENE_SERVER=preview E2E_UNITS=1 npm run scene:catalog -- --matrix --filter 'camera-hotfix-*' --query ui=1 --query debug=true --jobs 1 --backend webgl2|webgpu --size 1280x720 --out test-results/camera-hotfix/after-<backend>`.
- E18 counters: `E2E_PORT=3420 E2E_UNITS=1 sh tools/e2e-lock.sh npx playwright test tests/perf/e18-counters.spec.ts --project=chromium --workers=1`.
- Epic gate: `MI_VERIFY_REMOTE_SIM=1 E2E_PORT=3421 E2E_UNITS=1 npm run verify -- E22`; its native timing phase uses the bounded quiet-run reservation.

## Visual review

All twelve before sheets (WebGL/WebGPU × high/low × zoom 0.5/1/1.5) were opened. Every settled frame shows the same close overhead view: mostly the courier's cap, a short road segment and diagonal sidewalk. Zooming out reveals no additional street. Both backends and tiers reproduce the defect.

All 24 after sheets (two scenes × both backends × both tiers × three zooms) were opened. At settled frame 60, zoom 0.5 shows the full courier from the normal isometric angle; zoom 1 shows the street and adjacent cafe garden; zoom 1.5 widens to the opposite storefront and more of the cafe roof. The courier stays visible. The HUD scene keeps portrait/health at upper left, Controls/Sound below it, and the hint strip along the bottom. No overhead snap or unexpected return to the close view appears.

The final follow-up matrix adds the cellar and moved Lakeshore apartment: all 48 sheets (four scenes × both backends × both tiers × three zooms) were opened. Cellar views retain the courier, sidewalk, barricade and bakery frontage; wide zoom reveals the road instead of a single apartment wall. Lakeshore views retain the courier between the fences, the dark support surface and the adjoining grass/street; foreground shell clearance does not erase the fences or ground. The PO scene retains the cafe terrace and street at zoom 1/1.5 and the courier's full body at 0.5. High/low and WebGL/WebGPU agree in framing. The final matrix maximum is **40 draws / 159,527 triangles**, within both E18 tier budgets.

The real hide/line-break game captures were also opened: the close view shows boots, body and weapon rather than mostly cap; widening retains the cafe, cross-street, fire engine and nearby actors. The 1920×1080 and 2000×990 HUD captures show a single-line bottom hint, and the 1280×720 version wraps into two readable lines clear of Sound and vitals. Matrix rows enforce the requested backend/tier. The original two-scene matrix peaked at 37 draws / 118,525 triangles; the expanded final matrix is reported above.

| Evidence | Result |
| --- | --- |
| [Before WebGL matrix](before-webgl/index.md) / [before WebGPU](before-webgpu/index.md) | 6/6 each; defect visible at every zoom |
| [After WebGL matrix](after-webgl/index.md) / [after WebGPU](after-webgpu/index.md) | 12/12 each; all sheets opened |
| [Main camera negative control](camera-final-red.txt) | L4 reported spot, L5 and L7 fail; seven other levels pass |
| [Focused final regression](camera-final-focused.txt) / [expanded street sweep](camera-final-route.txt) | 25/25 pass; expanded final L1–L10 sweep also 10/10 on Hetzner |
| Real L4 browser regression | 4/4 pass; three zooms and all requested HUD sizes per case |
| [L4 WebGL/high proof](game-webgl-high/framing.json), [WebGL/low](game-webgl-low/framing.json), [WebGPU/high](game-webgpu-high/framing.json), [WebGPU/low](game-webgpu-low/framing.json) | Exact PO position; polar 54°; radii 9.5/19/28.5 m |
| [1280×720 HUD](game-webgl-high/hud-1280x720.png), [1920×1080](game-webgl-high/hud-1920x1080.png), [2000×990](game-webgpu-low/hud-2000x990.png) | Hint strip clear of vitals, companion, Sound and Controls |
| [E18 deterministic counters](e18-counters.txt) | 7/7 pass: high/low horde, L6, L5 and low male courier |
| [Isolated zoo timing](camera-zoo-isolated.txt) | Unchanged 200-actor simulation benchmark fails: 5.58 ms p95 vs 4 ms; low tier passes. No budget or simulation change made. |

## Final validation

[Typecheck](typecheck-final.txt), [lint](lint-final.txt) and [production build](build-final.txt) pass. The original `npm run verify -- E22` completed its remote CPU phase (110 selected tests passed), then exposed the facade-rendering regression in its browser phase. That browser phase was stopped to fix it; the original command is not claimed as an exit-zero gate. Staged reruns passed the complete 95-test E22 browser suite, then the final expanded facade selector passed the 12 targeted WebGL/WebGPU camera, cellar and blank-viewport tests. The final renderer/corpse suite passed 416/416 on Hetzner. The final deterministic E18 counters passed 7/7.

The broad remote unit/sim/levels run finished with 3183 passed, 3 failed and 11 skipped (509 files). One failure caught an early corpse-counter predicate before the lethal-frame correction; the corrected regression passes. The unchanged L10 campus timing measured 7.15 ms under load, then passed its isolated rerun. The unchanged Zoo 200-actor benchmark missed its 4 ms budget both in the broad run (4.03 ms) and isolated (5.58 ms); this remains unresolved. No timing budget was changed.

| Final evidence | Result |
| --- | --- |
| [Final WebGL matrix](final-webgl/index.md) / [final WebGPU](final-webgpu/index.md) | 24/24 each; all 48 sheets opened |
| [Remote renderer/corpse suite](camera-render-final.txt) | 416/416 pass |
| [E22 selected CPU summary](e22-cpu-summary.json) | 110/110 pass |
| [Broad E22 browser suite](e22-browser-final.txt) | 95/95 pass before final wide-facade selector extension |
| [Final targeted browser suite](camera-final-browser.txt) | 12/12 pass, including wide facades and actual WASD hint at three viewport sizes |
| [Final E18 counters](e18-counters-final.txt) | 7/7 pass |
| [Broad CPU failures](camera-full.txt) / [isolated L10](camera-l10-isolated.txt) | L10 isolated pass; Zoo timing miss remains |

## Native timing

The WebGL quiet-run batch was admitted at 13:17 UTC after approximately 17 minutes queued. Preflight recorded load 2.93, no other headless Chrome or local Vitest processes, and all browser slots held. The reservation released after 2.7 minutes. High passed all limits: war/collapse p95 **9.8/11.5 ms**, sim p95 **2.7 ms**, transition hitches at most **28.6 ms**.

Low under 4× CPU throttle failed at sim p95 **6.1 ms** versus 6 ms. Its captured collapse median **35.3 ms** also exceeds 33.33 ms; turn/line-break hitches **84.4/109.7 ms** exceed 80 ms. Draw/triangle and awake-prop counters remain within tier budgets. [Raw WebGL evidence](native-webgl/run.txt) retains the failure. [Previously tracked evidence](native-webgl/tracked-baseline-comparison.json), rather than a contemporaneous main rerun, already missed the low sim budget (6.25 ms), war median (35.8 ms) and turn hitch (86.4 ms); it does not establish the cause of the current collapse/line-break misses. The native gate is therefore **not green**.

All four native WebGL war/collapse captures were opened: high shows the firing line, bodies, stalls, bus, smoke and burning intersection; low retains the battlefield and courier in the tall phone crop. These are the existing authored overview presets used by the timing harness; gameplay camera regression evidence is in the game captures and matrix above.

After more than three minutes without a reservation (artifact review and comparison), the separate WebGPU batch was admitted at 13:23 UTC with load 2.84 and the same quiet preflight. It released after 2.7 minutes. High passed all limits: war/collapse p95 **10.3/10.6 ms**, sim p95 **2.5 ms**. Low failed sim p95 **6.4 ms** versus 6 ms; war/collapse medians **28.5/25.6 ms** and transition hitches **65.8/49.8/55.1 ms** meet their respective limits. [Raw WebGPU evidence](native-webgpu/run.txt) retains both results. Draws/triangles and awake props meet budgets on both backends and tiers; native low sim timing and the additional WebGL low frame/hitch misses remain unresolved. The unchanged Zoo CPU timing miss also remains. No limit was relaxed and no test skipped to obtain a pass.

All four WebGPU native captures were opened. They show the same battlefield composition as WebGL: active gunfire and bodies by the stalls in the war view, then the burning intersection and smoke in the collapse view. The phone crop retains the courier and the nearby stalls. Both backend assertions executed on native Chrome with `--use-angle=metal`; the WebGPU run additionally selected the actual WebGPU backend. Both held reservations were below three minutes, with a review break between them.
