# L4 movement and escape guidance — PO 2026-10-14

The movement fix, cellar guidance and army-line interaction changes are separate commits. No merge or deployment was performed.

## Movement cause

A round Rapier capsule can stand beside a collider corner while the nav grid's square radius expansion considers the same position blocked. `ControlIntent` asks the grid to sweep at a 0.37 m margin. Its former recovery only cut that square margin by at most 0.1 m; at a valid diagonal corner this was insufficient, so the resolved movement was zero for every outward click.

The real-mouse reproduction uses the shipped L4 armory table at `(-25.2, 0.6)`, rotated 90 degrees. The courier starts at its south-west corner `(-25.855, 1.855)`, with a valid circular footprint, and clicks open tiles six metres screen-left. The click reaches the input adapter at `(127.20, 360.00)` and resolves to `(-30.09764, 6.09764)`. On the unchanged source she moves zero metres and remains 6.00000 m from that target. [Input/position proof](before-movement.json), [opened game-camera capture](before-left.png).

`NavGrid.move` now tries the full circular footprint when recovering a player capsule from a rejected square margin. `ControlIntent` and the kinematic controller request that recovery explicitly; grid-only NPC movement retains its square margin. The first broad version changed campaign bot outcomes, so it was narrowed before acceptance. The unchanged L1 complete, L4 complete and L4 newbie tests then passed in a focused Hetzner rerun, alongside the actual-table and corner regressions (six tests). The existing bounded contact correction remains available for shallow overlaps. Every step still checks collision and Rapier still sweeps the capsule; camp boundaries and blockers retain their dimensions.

The unit regression checks all four collider-corner quadrants, including refusal to cross the solid. The L4 sim regression uses the real armory table and checks four six-metre open-tile goals by click intent, direct keyboard input and stick input after the convoy, the war start and a war respawn. Browser tests use physical mouse, WASD and CDP touch events, never injected movement frames. Close framing requires visible intermediate ground clicks for goals outside the viewport. The final four destinations stay six metres from the same start and must each be reached within one metre.

## Cellar guidance

The PO's 10-14 decision supersedes E22 section 4 / AC13's older `Find somewhere to hide` wording and 15-second soft-marker delay. The exact objective-text assertion was updated to `Run to the cellar`; no timing, health, density or performance assertion was loosened. Specs were not edited.

The standard world objective marker and shared off-screen arrow already existed. Removing L4's explicit marker suppression makes both available immediately when the line breaks. The fallback shout now says `Fall back! Get to the cellar!`, and the follow-up reinforces that destination. The existing line-break checkpoint at the escape street remains the respawn point. New sim and browser checks cover immediate text/subtitle/marker, arrow direction, the doorway beacon and checkpoint retention after death.

## Army barricades

Army-line slots explicitly declare `playerBuildable: false`. They still take damage, emit broken-line events, remove their collision/nav blockers and contribute to the collapse director. They never enable bracing, repair or rebuilding. The view uses the same sim permission for prompt selection and dashed placement rails, including old checkpoint slots without the new field. Campaign rebuilding is available only in the existing L2/L6 missions; generic E26 sandbox fixtures retain it. Build, repair and board-up captions explain their purpose in plain words.

New L4 sim/browser checks stand beside all three broken army slots in war and collapse, verify that no rebuild prompt appears, and press the real interaction key without restoring the barricade. A separate E26 regression checks disabled auto-build, repair and direct completion events.

## Evidence and validation

The final native headless browser matrix passes **40/40** cases: 24 movement cases, eight cellar-guidance cases and eight broken-army-line cases. Every combination of WebGL/WebGPU, high/low quality, zoom 1.0/0.5 and plaza/war/respawn is covered for movement. All 288 six-metre destinations were reached; maximum error was **0.148 m** (mouse 0.123 m, keyboard 0.148 m, stick 0.130 m), against the unchanged 1 m limit. All eight guidance cases verify the cellar anchor, arrow angle and viewport containment as well as the doorway beacon. The existing E26 build/repair/break browser case also passes with the new purpose caption.

I opened the game-camera captures:

- [Leftward walking, WebGL high / zoom 1](walk-left-webgl.png): the courier's rifle and stride point left, with the cyan destination ahead on open paving and the supply crates behind her.
- [Leftward walking after respawn, WebGL low / zoom 0.5](walk-left-close-low-webgl.png) and [WebGPU low / zoom 0.5](walk-left-close-low-webgpu.png): the courier reaches the cyan ring; the backpack corgi follows from the right.
- [Armory corner escape](armory-corner-left-webgl.png): the courier is clear of the table on its left, with the rifle and cyan ring visible; the table remains solid.
- [Plaza escape arrow](cellar-plaza-arrow-webgl.png): the HUD reads `Run to the cellar · 92 m`, the subtitle reads `Fall back! Get to the cellar!`, and the gold edge arrow points down-right toward the off-screen door.
- [Doorway beacon, WebGPU low](cellar-door-beacon-webgpu.png): the same objective reads 2 m; a gold world triangle and ground ring identify the cellar door. The edge arrow is replaced by the nearby marker.
- [Broken line, WebGL](broken-line-webgl.png) and [close WebGPU](broken-line-close-webgpu.png): the courier stands beside fallen soldiers and broken military cover, with no brace/rebuild panel or white placement rails. The cellar objective and direction arrow remain visible.

Scene catalog additions: `l4-plaza-walk-left`, `l4-armory-corner-left` and `l4-broken-army-line`. Each uses the game follow-camera matrix. Runs use dedicated ports, headless Metal/WebGPU, one browser unit, and bounded quiet-run timing reservations.

The WebGL Scene Lab matrix passes **18/18**, including the extra far zoom 1.5. I opened all three scenes at both tiers and zooms 1.0/0.5. The [corner sheets](scene-corner-webgl-high.jpg) show continuous departure followed by arrival, with **zero penetration frames**; the [low/close corner sheet](scene-corner-webgl-low-close.jpg) preserves the same movement. The [plaza sheet](scene-plaza-webgl-close.jpg) shows the courier walking left and the corgi catching up. The [broken-line sheet](scene-broken-line-webgl.jpg) shows cover disappearing after damage, with no dashed rail or interaction panel.

The WebGPU Scene Lab matrix also passes **18/18**. I opened the corresponding 12 sheets at both tiers and zooms 1.0/0.5: [corner, low/close](scene-corner-webgpu-close.jpg), [plaza, high](scene-plaza-webgpu.jpg), [broken line, low/close](scene-broken-line-webgpu-close.jpg). They show the same movement and disappearance of broken cover, preserve the courier/corgi appearance, and report no console errors, missing actors or corner penetration.

The whole isolated Hetzner timing project passes **184/184 tests in 22 files** on `91.98.11.241`. The full sweep on `2.28.24.66` initially exceeded six high-tier timing budgets; those thresholds remain untouched. Four affected fixtures passed in an immediate isolated repeat (eight high/low cases), then the whole timing project passed on the runner where the first sweep's timing tests had also passed. These are separate results, not a claim that the full sweep on `2.28.24.66` exited green.

[Movement results](movement-results.json) preserve all reached positions and per-case renderer/tier counters. Every route sample now also asserts the existing E18 draw/triangle limits. The full movement matrix peaks at 252 draws / 933,253 triangles high and 227 draws / 286,948 triangles low, across both backends and zooms. [Validation summary](validation.json) records the matrix and suite results.

Commands (heavy suites run only on Hetzner):

```sh
npm run typecheck
npm run lint
npm run build
sh tools/remote/run.sh "$PWD" --pull test-results/l4-walk-left/full-final.json -- bash tools/remote/timing-isolated.sh npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4 --reporter=default --reporter=json --outputFile=test-results/l4-walk-left/full-final.json
MI_RUNNER_IP=91.98.11.241 sh tools/remote/run.sh "$PWD" --pull test-results/l4-walk-left/timing-final.json -- bash tools/remote/timing-isolated.sh npx vitest run tests/unit tests/sim --project=timing --maxWorkers=1 --reporter=default --reporter=json --outputFile=test-results/l4-walk-left/timing-final.json
E2E_PORT=34871 E2E_UNITS=1 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/l4-plaza-movement.spec.ts tests/e2e/levels/l4-cellar-guidance.spec.ts tests/e2e/levels/l4-barricade-prompts.spec.ts --project=chromium --workers=1
E2E_PORT=34874 E2E_UNITS=1 sh tools/e2e-lock.sh npx playwright test tests/e2e/barricades.spec.ts --grep T-E26-16-browser --project=chromium --workers=1
SCENE_PORT=34873 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/catalog.ts --matrix --backend webgl2 --filter 'l4-plaza-walk-left,l4-armory-corner-left,l4-broken-army-line' --jobs 1 --out test-results/l4-walk-left/scene-webgl-final
SCENE_PORT=34872 SCENE_SERVER=preview E2E_UNITS=1 sh tools/e2e-lock.sh npx tsx tools/scenelab/catalog.ts --matrix --backend webgpu --filter 'l4-plaza-walk-left,l4-armory-corner-left,l4-broken-army-line' --jobs 1 --out test-results/l4-walk-left/scene-webgpu-final
MI_RUNNER_IP=91.98.11.241 MI_VERIFY_REMOTE_SIM=1 E2E_PORT=34875 E2E_UNITS=1 npm run verify -- E22
```

## Native performance

The existing L4 stress test passes both WebGL tiers under a quiet-run reservation lasting 224 seconds, including its preflight. Desktop high has war p95 10.9 ms / collapse p95 10.4 ms against 14 ms; sim p95 2.7 ms against 4 ms; transition maximum 17.6 ms against 50 ms. Phone low at 4× CPU throttle has war p50 22.1 ms / collapse p50 25.6 ms against 33.33 ms; sim p95 5.5 ms against 6 ms; transition maximum 70.3 ms against the existing 80 ms phone limit. Draws/triangles peak at 333 / 1,420,734 high and 217 / 365,441 low, within the existing 600 / 1,500,000 and 300 / 500,000 limits. Awake prop counts remain inside their limits. The stress population includes 85 infected/40 civilians high and 48 infected/20 civilians low.

[Desktop WebGL measurements](performance-webgl-high.json), [phone WebGL measurements](performance-webgl-low.json). The test now accepts `E2E_RENDERER=webgpu` and asserts the actual backend. This adds the binding backend measurement without changing any acceptance threshold. Each reservation has an automatic 19-minute timeout, and reservations are separated by a break.

WebGPU also passes both tiers. Desktop high has war/collapse p95 **10.0 / 9.5 ms**, sim p95 **2.3 ms**, and transition maximum **17.7 ms**. Phone low at 4× CPU throttle has war/collapse p50 **21.5 / 25.9 ms**, sim p95 **5.3 ms**, and transition maximum **58.0 ms**. Its draw/triangle/prop counts also pass the same limits. The second reservation lasted 373 seconds including its queue/preflight, and began more than two minutes after the first reservation released.

[Desktop WebGPU measurements](performance-webgpu-high.json), [phone WebGPU measurements](performance-webgpu-low.json), [quiet-run preflight records](quiet-run-conditions.json). Ports 34876 (WebGL) and 34877 (WebGPU), native headless Chrome/Metal, one worker:

```sh
E2E_PORT=34876 sh tools/perf/quiet-run.sh npx playwright test tests/perf/l4-budgets.spec.ts --project=chromium --workers=1
E2E_PORT=34877 E2E_RENDERER=webgpu sh tools/perf/quiet-run.sh npx playwright test tests/perf/l4-budgets.spec.ts --project=chromium --workers=1
```

Both commands were supervised by a process-group timeout of 1,140 seconds to enforce the reservation limit; neither timed out.

## Final gates

- **Full Hetzner functional suite: 2,469 passed, zero failed, 365 executed files.** All 48 executed `tests/levels/L4*` tests pass, including convoy, collapse, respawn, the complete/newbie bots and the six new movement/guidance/army-line cases. The two existing manual L4 probe files remain skipped. L2's 16 tests, L6's 11 tests and all 22 E26 barricade sim tests pass.
- **Whole isolated timing suite: 184 passed, zero failed, 22 files.** The full combined run on `2.28.24.66` exited 1 with six timing failures and no functional failures; the entire timing project passed unchanged on `91.98.11.241`. [Validation summary](validation.json) lists the original failed timing titles and the separate rerun.
- **`npm run verify -- E22`: exit 0.** Typecheck, lint, fresh production build, 85 remote sim tests, 88 native browser checks and both native performance cases pass. The 88-case gate includes all 17 convoy smoothness configurations and repeats the new movement matrix with E18 geometry assertions. [Exact gate command results](e22-checks.json).
- **Visual/backend matrix: 40/40 new browser cases, 36/36 Scene Lab runs; native WebGL and WebGPU high/phone-low stress cases all pass.** Relevant captures and the 12 sheets per backend at high/low and zoom 1.0/0.5 were opened and reviewed above.

All runtime changes and regression fixtures are committed on `lane/l4-walk-left`. Movement is `4ab866a9` plus the necessary player-only correction `2a8c6e20`; apply that pair together. Cellar guidance is the separate `8f863eef` commit; army-line rebuilding is `373156d0`. Subsequent commits contain fixture, geometry-budget and WebGPU validation changes. No thresholds, layouts, static-collision dimensions or forbidden reference assets were changed. Generated tracked test artifacts were restored; the selected review evidence is kept in this report directory. No merge or deployment was performed.
