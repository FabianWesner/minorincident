# Camera hotfix — PO L4 refuge-door-7

At player `(-56.23, 32.11)`, the follow ray intersects `bld.cafe-corner:7` about 5.30 m from the focus. `View.clearLens()` contracted the horizontal offset to stop before that facade, then raised the camera to maintain the 9.5 m minimum radius. Every wheel zoom hit the same contraction again. The camera's reported zoom/polar described the requested rig, hiding the actual 29.36° polar error at the reported spot.

Removed facade clearance from the follow camera and its district-volume registration. The existing see-through/silhouette presentation owns occluding walls. Player zoom now controls the full offset at the normal 54° polar angle; authored cinematics, story pulls, and vehicle framing retain their existing behavior. Removed the obsolete convoy clearance flag and updated the atmosphere capture tool that saved it.

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

The real hide/line-break game captures were also opened: the close view shows boots, body and weapon rather than mostly cap; widening retains the cafe, cross-street, fire engine and nearby actors. The 1920×1080 and 2000×990 HUD captures show a single-line bottom hint, and the 1280×720 version wraps into two readable lines clear of Sound and vitals. Matrix rows enforce the requested backend/tier. The maximum scene counters are **37 draws / 118,525 triangles**, within both E18 tier budgets.

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

Typecheck, lint and production build pass. Full CPU and epic/performance gate results follow below.
