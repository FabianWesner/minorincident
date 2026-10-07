# L1 v2 lane F: bicycle fixes

## Changes

- Synced main into the lane (`64d6f046`) and retained the handover's useful apron placement and measured saddle alignment.
- `92466db0`: constrain the rider's pelvis to the authored saddle and solve both arms onto the authored handlebar grips after posing. The production GLB unit check now covers both courier variants, three headings, four pedal phases, frame lean and desktop/mobile scales: pelvis-to-seat distance 0.04 m; each palm within 0.015 m of its grip. The original model coordinates and asset LOD checks remain strict.
- `fc26a330`: require 0.45 m clearance when mounting/parking; the rack's 0.706 m gaps cannot accommodate this clearance. Permit slow front-wheel steering while pushing against an obstacle so a stopped bike can pull away. Park at a validated curb spot beside the depot counter approach, keep objective interaction priority, and prevent immediate automatic remount while waiting for the parcel.
- Added sim regressions for mounting at (-68.1, 7.6), riding into a wall then escaping, depot parking and remount with the parcel. The kinematics fixture now measures turn radius on open ground rather than against café geometry; its tolerances are unchanged.

## Root causes

The main saddle test assumed the seat's world X was zero, although the rebuilt model's seat is at -0.65 model metres (-0.39 m at game scale). Runtime pelvis placement uses the actual seat node. Testing the production courier contacts verifies that this measured-seat design really fits the rider instead of loosening tolerances.

The main bike spawned inside the rack. Its periodic rescue relocation chose a spot beside the player that lay directly on S-02's +Z walking path; the solid parked bike then repelled the player. Starting on the clear apron prevents that relocation and obstruction. S-02's destination and 0.15 m tolerance were not edited.

The rack mounting check used only the bare 0.35 m capsule radius, so the tiny bar gap passed despite lacking controller/route margin. The direct riding model also derived steering from achieved movement, leaving the heading effectively frozen at a wall. The changes address both causes.

The depot previously parked near the edge of its 5 m arrival trigger, several metres from the hand-over. The explicit clear curb spot is within 1.5 m of the depot doorway, beside the walking approach, and the rider can remount and ride away with the parcel.

## Validation

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `sh tools/sim-lock.sh sh -c 'npm run test:unit -- --maxWorkers=2 > /tmp/l1v2-f-unit.log 2>&1'` | 235/235 tests, 75/75 files PASS |
| `sh tools/sim-lock.sh sh -c 'npx vitest run tests/sim/l1-toys.test.ts --maxWorkers=2 > /tmp/l1v2-f-targeted-details.log 2>&1'` | 16/16 tests PASS |
| `E2E_PORT=3346 npm run test:smoke` | 5 sim + 22 browser tests PASS, including S-02, Chromium, four mobile projects and WebKit |
| `E2E_PORT=3346 sh tools/e2e-lock.sh sh -c 'npx playwright test tests/e2e/bicycle.spec.ts --project=chromium --workers=1 > /tmp/l1v2-f-rider.log 2>&1'` | 1/1 PASS; screenshot `courier-bike-rider.png`, visually reviewed |
| `E2E_PORT=3346 sh tools/sim-lock.sh sh -c 'npm run verify -- E19 > /tmp/l1v2-f-verify.log 2>&1'` | CANCELLED by orchestrator during the long simulation battery; 63 printed passing tests across 18 completed files, no printed failures; no complete totals |

The first smoke attempt had 19 browser passes and three WebKit launch failures (S-11 audio suspension, S-01 foundation boot, S-10-foundation reload; all pre-existing environment setup failures) because this new Mac lacked `webkit-2359/pw_run.sh`. `npx playwright install webkit` repaired the environment; the full command then passed all 22 browser tests. No browser retry setting was increased.

## Spec deviations and remaining work

Full E19 verification remains incomplete. The orchestrator explicitly stopped it after about 30 minutes and assigned the full run to `l1-closure`. Static typecheck/lint/build stages passed; long level-file results, subsequent sim files, tagged browser selection and transition perf were not completed. No main baseline run was performed, as instructed. There are no remaining failures in the completed unit, targeted bike/toy, smoke or rider suites.

No specs or assets were changed. At negligible speed, pushing the bike can slowly turn its front wheel to escape contact; a stationary rider with no movement input still does not turn. Full-speed turning, acceleration and coasting remain covered by the existing kinematics assertions.

Foot placement uses the existing authored pedalling animation. This lane constrains saddle and palm contacts; it does not replace the animation library or the separate skin pilot.
