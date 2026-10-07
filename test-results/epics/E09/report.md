# E09 — vehicle feel update

## Changes

Base: `642f8fe0` on `lane/vehicle-feel`. Bruno reference: folio-2025 commit `41046b5`, read-only. No main merge, push or deployment.

- `16d58119`: all seven drivable cars retain four Rapier raycast wheels and gain data-driven suspension damping/travel, engine plateau/taper, reverse speed/braking, speed-scaled smoothed steering, rear handbrake grip/braking, a stable low centre of mass, fixed-tick stuck detection and physical flip recovery. Wheel steer, suspension and chassis rotation interpolate from fixed-step state. The cargo bike keeps its existing speed-scaled capsule navigation and gains speed-aware wheel steering and deterministic frame lean. Rider attachment code was untouched. Bruno PhysicsVehicle, Player and VisualVehicle attribution is recorded in THIRD_PARTY_NOTICES.md with the MIT license.
- `fe4da790`: arrows drive locally alongside WASD; keyboard RIGHT and touch DRIFT hold the handbrake. Existing mouse, touch stick, boost, brake and exit inputs remain available. The bot's throttle/steer/brake/boost interface stays compatible; handbrake is optional.
- `5ee85ee9`: single-slot browser locking waits in the kernel instead of polling; repeated runs in other lanes had starved this lane's checks. Multi-slot behaviour is retained. No nested locks were used in final npm verifier/smoke/e2e commands.
- `4ac0d3d9` and final evidence commit: browser integration fixes: touch DRIFT release clears held input; mouse fixture widens its camera before projecting the required ten-metre cursor; the harness lists the current delivered API; native police lamp probes and reviewed goldens replace stale placeholder probes/images. Town review capture replaces the rejected empty-plane clip.

## Mechanical evidence

| Measurement | Result | Required |
| --- | --- | --- |
| Sedan speed after 4 seconds | 15.48234 m/s | ≥14.4 m/s |
| Full-lock radius / mean speed | 10.39594 m / 10.69182 m/s | 8–14 m near 10 m/s |
| Maximum flat-slalom roll | 0.54235° | <60° |
| Bot course | 600.48242 m in 39.68333 s, 300 HP | 600 m within 90 s |
| Paused native-car fixture | 60 draw calls / 140,353 triangles | ≤600 / ≤1,500,000 |
| Brake on/off red pixels | 526 / 0 | visible brightening |
| Alternating siren pixels | 585 / 602 | both lamps change |

Sources: handling-metrics.json, course-metrics.json, render-perf.json and visual-metrics.json. The sim tests cover all seven speed-scaled steering limits, actual rear slip under handbrake, reverse limiting, stuck recovery, sedan/bus physical flip recovery and driver-only recovery ownership. The existing three-world 1,800-tick determinism gate remains enabled. `review.md` documents the native-model screenshot review.

## Validation

All final static/build/sim/browser commands exit 0 except the explicitly reported all-level completion command. Browser commands use headless ANGLE/Metal, DPR 1, at most two workers and port 3347; npm scripts own their browser lock.

| Exact command | Result |
| --- | --- |
| `npm run typecheck` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0 |
| `sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=2` | PASS, 257 tests / 77 files |
| `npm run test:smoke` | PASS, 5 sim + 22 browser tests |
| `E2E_PORT=3347 npm run verify -- E09` | PASS, 38 sim + 33 browser tests; typecheck/lint/build also pass |
| `E2E_PORT=3347 npm run test:e2e -- tests/e2e/driving.spec.ts tests/e2e/vehicle-feel.spec.ts --workers=2` | PASS, 8 browser tests |
| `sh tools/sim-lock.sh npx vitest run tests/sim/l1-toys.test.ts tests/levels/l1-ride-input.test.ts --maxWorkers=2 --testTimeout=180000` | PASS, 27 tests / 2 files |
| `sh tools/sim-lock.sh npx vitest run tests/unit/tooling/headless-only.test.ts --maxWorkers=1` | PASS, 1 test |
| `npm run test:levels` | FAIL, 12/18 completions; L3 and L6 stall |

The first E09 run had four browser failures (stale mouse/camera fixture, touch release, API surface list and placeholder golden). All four are corrected and pass in the final run. The first focused bike run passed 26/27, with the garage-door test taking 104 seconds on the shared Mac against the default 30-second timeout. The extended-timeout run passes 27/27 without a navigation code change. Unit, verifier, smoke and focused browser logs are in `logs/`; `checks.json`, `vitest.json` and `verify-playwright.json` are the final machine results. `acceptance-results.json` indexes passing tests for all 11 E09 criteria.

## Town review video

`test-results/vehicle-feel/driving.webm` is **11.36 seconds, 960×540, WebM, 1,642,887 bytes**. It replaces the deleted empty-plane review clip. The first segment uses L1 Row Street / Juniper at the ordinary follow camera: acceleration to 7.32 m/s, cone destruction, an approximately 90° corner, and an opposing handbrake turn. The second segment in the same town runs one side's wheels over the accessible 0.35 m `dressing:planter:548` edge near the bakery; chassis height peaks at 0.85383 m from a settled 0.73543 m. The straight-edge pass was recorded separately because the first attempted curb target was blocked by the medical building. There are no teleports during either recorded manoeuvre; fixture placement and town loading are trimmed out. The two segments have a direct edit between them. Ordinary foreground roofing/foliage partly obscures the end of the drift; the normal gameplay camera is preserved.

The montage metadata and fixed-step manoeuvre samples are next to the video. The raised planter edge is the existing physical curb-like obstacle; street sidewalk surfaces alone have no curb colliders. Raw recordings, ad-hoc frame extracts and the lane's intermediate build are removed after review.

## Deviations and remaining work

No spec criterion changed and no dependency was added. Bruno's variable-time callbacks and wall-clock recovery were adapted to fixed simulation ticks; hydraulics and decorative antenna/blinker work were not added. Body roll comes from the physical chassis rather than a second visual pose. The cargo bike retains its existing capsule/path navigation model to preserve routes and rider ownership.

`npm run test:levels` completed **12/18 runs**, with zero deaths. L1, L2, L4 and L5 pass all three seeds. L3 stalls at `market-route` after 59.43333 s on all three seeds; the orchestrator confirms the same failure on main and has instructed this lane to finish before merging l3-content. L6 also stalls at `drive` after 103.43333 s on all three seeds; that extra level is included by the all-level script and remains a reported failure. Do not claim level validation is green. Resume this lane after l3-content lands, merge main into the lane, and rerun test:levels.

Human review of the town video remains the feel judgement; automated gates establish steering, suspension, drift and recovery behaviour. No manual native-WebGPU check was performed in this headless lane.
