# Q-276 / Q-277 follow-up

Branch: `lane/q276`. No publication or deployment.

## Changes

- `7e91c1b17`: every civilian batch prepares death-back, death-side and death-crumple at its settled corpse LOD. This includes police, soldiers and civilians, rather than a level allow-list.
- `ea6507302`: checkpoint restore retains warmed frozen materials, geometry and reusable pages. Previously replacing entity objects disposed the warmed pool; a later police side death compiled `corpse_pal_picketWhite` again. The shared render contract exercises three repeated restores with 259 bodies across three pages, preserving resource identity.
- `97b8af538`: the visible L3 HUD and legacy tracker measure the active objective anchor. The marker still follows `l3-route` waypoints.
- `e57bc2bc3`: the read-only playtest observer records first-frame load duration for auto-started levels such as L10.
- `6b9bbd42f`: seated copies preserve authored vertex paint on palette pieces, including red firefighter helmets. Registry atlas maps and UVs remain intact.

## Warm-up audit

Every model registered through CivilianCrowd, including later discovered campaign cast, now prepares all three death poses. The same rule covers all ten levels; it has no exception for a model or level.

| Level | Civilian cast registration | Settled corpse LOD, high / low |
| --- | --- | --- |
| L1 | staged L1 roster and nearby models | 1 / 1 |
| L2 | core roster plus discovered firefighters/story cast | 1 / 1 |
| L3 | L3 civilian/police/national-guard roster | 2 / 2 |
| L4 | core roster plus discovered soldiers/story cast | 1 / 2 |
| L5 | core roster plus actual fixed survivors/lookouts | 1 / 1 |
| L6 | fixed subway cast plus L1 pedestrian models, before Begin | 1 / 1 |
| L7 | actual entity roster prepared before view initialization | 1 / 2 |
| L8 | core roster plus actual zoo staff/visitors | 1 / 1 |
| L9 | core roster plus discovered cast | 1 / 1 |
| L10 | core roster plus discovered cast | 1 / 1 |

Native infected retain their existing preparation: all three regular death poses at LOD2, regular near bodies at LOD1, crawler side pose, Alpha back pose and Mega Alpha side pose at the authored Alpha band. No warm-up item was skipped.

## Real-input L3

[Receipt](evidence/l3-run.json), [reviewed HUD capture](evidence/l3-objective-distance.jpg).

Low, visible HUD only, real keyboard/mouse, no objective skips or assists: 455 active simulation seconds, two deaths/restores, **zero late shader builds**, **zero active frames over 200 ms**. The checkpoint transition reads 363 m in the capture while the next route ring is nearby. Runtime observation recorded 364 m at the transition tick.

This run is evidence for shader stability and the HUD correction. It stopped at a driver navigation stall at x143.7, z−0.9 (81 m from the checkpoint), and is not a completed-level receipt. Before the pool-retention correction, two real-input preflights reproduced one late police side-death build each (ticks 16704 and 20498); the second preflight completed L3. Those failures were not counted as passing shader checks.

## Passenger review

[Material/UV receipt](evidence/occupants.json). Reviewed normal-shell and cutaway captures at both high and low. L2 uses its actual six boarded firefighters and the courier. The bus is an explicit art fixture using the production VehicleOccupant renderer at the delivered passengerSeat0L/0R sockets (firefighter and civilian woman); it does not claim scripted bus boarding coverage. The school-bus simulation definition has no transported NPC seat list. The L1 bike has only the courier rider and no NPC passenger slot.

All firefighter copies retain six mapped meshes with UVs; the civilian woman retains one. Palette helmet paint is red with the authored trim. Close cutaways expose the existing LOD1 faceting; this check verifies material presence and paint, not LOD geometry quality.

| Vehicle | High | Low |
| --- | --- | --- |
| Fire engine, shell hidden for material inspection | [capture](evidence/fire-engine-high-cutaway.png) | [capture](evidence/fire-engine-low-cutaway.png) |
| Bus fixture, shell hidden for material inspection | [capture](evidence/bus-high-cutaway.png) | [capture](evidence/bus-low-cutaway.png) |

## Load and two-minute play audit

Measured through the real menu/Begin flow on QA preview, followed by visible-HUD keyboard/mouse play. L10 deliberately calls Mission.begin before asset loading to prepare its resident actors/chunks; it has no Begin button. Its diagnostic now reads the game's `transition:L10:first-frame` User Timing duration. An initial high-tier run passed 127 seconds of play but failed the timing harness's Begin-only assumption; it is retained as a preflight and rerun with the corrected observer. Each sample asserts at least 120 simulation seconds, no console/page errors and no active frame over 200 ms; full driver watch findings are retained separately.

The L4 high sample raised one `enemy-frozen` watch for infected #329 at tick 5150 (7.5 m from the player, 2/210 HP). [Reviewed capture](evidence/L4-high-enemy-watch.jpg) shows the crowded west breach. This is an unconfirmed gameplay follow-up, not a console error or frame failure. The low-tier L4 sample had no driver watch findings. No claim is made that all AI behavior was clean in the high-tier sample.

## Reproduction

An overlapping local QA build invalidated one public-build smoke phase (QA globals were present). A clean sequential rerun supersedes it; no product failure is inferred from that run.

Final validation uses shared headless pool jobs, real Metal WebGL2 on macOS, E2E_PORT=4861 and SCENE_PORT=4862. Scene gate also checks WebGPU. Profiles are deleted after use.

- L3: `PLAYTEST_VISIBLE_ONLY=1 PLAYTEST_SHADER_GUARD=1 PLAYTEST_FRAME_GATE=1 E2E_PORT=4861 SCENE_PORT=4862 node --import tsx tools/playtest/play.ts --levels L3 --entry debug --no-skip --mode campaign --quality low --level-minutes 9 --out test-results/q276/l3-final`
- Passenger fixtures: `E2E_PORT=4861 SCENE_PORT=4862 sh tools/e2e-lock.sh node --import tsx docs/reports/q276/checks/occupants.ts`
- Two-minute samples: `PLAYTEST_VISIBLE_ONLY=1 PLAYTEST_FRAME_GATE=1 E2E_PORT=4861 SCENE_PORT=4862 sh tools/e2e-lock.sh node --import tsx docs/reports/q276/checks/level-samples.ts high` (repeat with `low`). Requires `npm run build:qa`; uses production preview. Do not run this concurrently with smoke on the same port.
- Standard checks: `npm test`, `npm run typecheck`, `npm run lint`, `E2E_PORT=4861 SCENE_PORT=4862 npm run test:smoke`, `E2E_PORT=4861 SCENE_PORT=4862 npm run scene:gate -- --jobs 1 --out test-results/q276/scene-gate-committed`.

The smoke freeze guard settles a civilian, a police officer and a national guard, proves all three are drawn, restores a checkpoint, then rejects new corpse shader graphs. It also verifies the visible objective-distance text while the marker remains `l3-route`.

## Final standard checks

| Check | Result |
| --- | --- |
| `npm test` | 110/110; 150/150 collected-case budget respected |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run test:smoke` | 6 QA + 1 public pass; 96.4 s; zero late corpse graphs after death and restore |
| `npm run scene:gate -- --jobs 1` | 48/48; 0 known, 0 not run; WebGL2/WebGPU, high/low |

Logs and machine receipts are in [evidence](evidence/). The final gate additionally reviewed the corpse-placement-pile WebGPU low and bus-hero WebGL2 high contact sheets. Source changes use existing test cases; no test-count or timing budget was raised.

### Completed samples

| Level / tier | Load to Begin or playable frame | Active play | Frames >200 ms | Console/page errors | Capture |
| --- | ---: | ---: | ---: | ---: | --- |
| L1 high | 2.453 s (Begin) | 130 s | 0 | 0 | [reviewed](evidence/L1-high-play.jpg) |
| L1 low | 2.602 s (Begin) | 130 s | 0 | 0 | [reviewed](evidence/L1-low-play.jpg) |
| L4 high | 7.824 s (Begin) | 126 s | 0 | 0 | [reviewed](evidence/L4-high-play.jpg) |
| L4 low | 6.774 s (Begin) | 127 s | 0 | 0 | [reviewed](evidence/L4-low-play.jpg) |
| L10 high | 6.116 s (first frame) | 127 s | 0 | 0 | [reviewed](evidence/L10-high-play.jpg) |
| L10 low | 5.700 s (first frame) | 127 s | 0 | 0 | [reviewed](evidence/L10-low-play.jpg) |

[Full sample receipt](evidence/level-samples.json). All six samples have zero skips and zero assists. The high-tier L4 watch finding above is retained. These are bounded opening play samples, not full-level completion runs.
