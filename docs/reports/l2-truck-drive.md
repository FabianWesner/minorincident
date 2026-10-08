# L2 fire-engine passenger drive

Lane: `lane/l2-truck-drive`. The prerequisite `worktree-agent-a93cb436eace68273` and main through `17fc6b7d` are merged. The crash recovery preserves `aac694b3` and completes its remaining clearance and tyre work.

Implementation commits include recovered `aac694b3`, clearance/tyres `8436e011`, passenger routines `093bff1e`, contact cache `fb864b94`, browser launch config `812c2dcf` and handoff snapshot `bbd6faf7`.

## Route and motion

- Right-hand lane centres: east on Elm at z=31.25, north on Juniper at x=-28.75, west on Main Row at z=-32.25. Arrival is (-43, -32.25).
- Tangent junction arcs have 9 m centre radius (10.7 m outer body radius). The station apron has 6.2 m centre radius (8.14 m outer body radius), followed by a smooth settling curve onto Elm.
- Arc-distance motion follows the curve tangent. A backward braking envelope preserves 7.6 m/s cruise, caps junction speed at 4 m/s, and respects 2.6 m/s² acceleration / 4 m/s² braking and 25°/s yaw.
- The driver sweeps the full 7.4 × 2.1 m footprint along the upcoming curve. Bodies, traffic, parked cars, tipped props and walls cause braking. Pedestrians walk to kerb positions clear of the entire bend; traffic yields. The prerequisite's timed body relocation is removed.
- Passenger station routines pause when the crew boards and resume at the existing crew exit. A planted seed exposed a 60 s routine expiry that made three seated firefighters appear inside the body; a 65 s stopped-ride assertion now covers it. Before this fix, the repeated-pedestrian seed 17 recorded 61 actor-frame overlap observations across those three crew members; the final 40-seed run records zero.
- The corner sedan, Elm sedan and corner lamp are placed outside the swept route. The truck's collider retains its drawn dimensions.
- Wheel spin follows vehicle speed; front steering follows curvature. Small chassis roll/pitch accompany the kinematic ride. Tyre face contacts settle on actual drawn ground and recheck after suspension movement at paving boundaries. Brake lamps follow deceleration. Stationary wheels reuse the exact settled contact until their pose or ground field changes; moving and steering wheels retain the full triangle probe.

## Measurements

The before numbers are the recovered legacy-driver geometry diagnostic against the prerequisite layout, not a full 20-seed baseline. Its yaw maximum was 154.70°/s, heading jump 2.58°, lane share 0%, and static footprint-overlap frames 0. The prerequisite reported 13/20 seeds meeting the cluster kill limit.

Fresh complete-bot battery: 20/20 complete, 122.23–134.40 s (median 126.93 s), every natural ride 24.58 s, and all 20 seeds meet the unchanged cluster kill limit (0–1 of 13 killed). All 13 cluster members are present at approach on every seed. Newbie and no-axe also complete 20/20; their medians are 138.91 s and 128.27 s respectively. Complete and newbie have 0 median deaths and remain inside the existing bot bands.

Fresh natural clearance: **20/20**, 24.58 s each; max yaw **24.58°/s**, max heading jump **0.410°**, accel **2.60 m/s²**, braking **4.00 m/s²**, minimum right-lane share **95.67%**, body/vehicle/prop/static overlaps **0**. Planted clearance: **20/20**, 25.93–29.23 s including yielding; max yaw **24.64°/s**, max heading jump **0.411°**, minimum lane share **95.67%**, overlaps **0**. Both loops meet acceleration / braking caps. The route and both vehicle-obstruction tests also pass, including the 65 s stopped ride. Full E20 verification: pending.

| Scene Lab fixture | Frames | Max yaw °/s | Body / vehicle overlaps | Wheel sink | Route remaining |
| --- | ---: | ---: | ---: | ---: | ---: |
| Game camera | 660 | 24.03 | 0 / 0 | 0 cm | 0 m |
| Top camera | 660 | 24.03 | 0 / 0 | 0 cm | 0 m |
| Full district ride | 1650 | 24.58 | 0 / 0 | 0 cm | 0 m |

All three isolated scenes passed their gates, with zero console errors. Full-route tyre gaps are 0.1–0.2 cm above the drawn ground. The full fixture uses the actual L2 district static layout and an elderly pedestrian planted at the second turn; the 20-seed sim battery covers the mission population. The final cached-wheel frames were inspected again, including the game-camera bend and the real-input closing checkpoint. The scenes were rerun against final code after the passenger routine fix and the stationary-wheel contact cache. Final 20 complete-bot records are byte-for-byte equivalent to the earlier records before the conservative candidate-distance optimisation and passenger routine pause.

## Performance gate investigation

The unchanged T-E20-20 gate currently fails on both the lane and untouched merged main `17fc6b7d`. Both were built and measured headlessly on the same Mac, one browser at a time. Two unrelated heavy Vitest jobs were also using this shared Mac.

| Measurement | Lane before contact cache | Lane after contact cache | Main `17fc6b7d` |
| --- | ---: | ---: | ---: |
| Desktop update p95 | 10.7 ms | 2.0 ms | 1.9 ms |
| Desktop frame p95 (limit 14 ms) | 34.9 ms | **14.4 ms** | **14.6 ms** |
| Phone triangles (limit 500,000) | 546,333 | **546,333** | **527,667** |
| Phone frame p50, 4× CPU (limit 33.33 ms) | 58.0 ms | **49.2 ms** | **42.2 ms** |

The new wheel-contact cost is corrected by commit `fb864b94`; all Scene Lab contact gates pass again. The remaining phone triangle overflow cannot be attributed to Mac contention, and the timing gates are not green. No budget, population or drawing criterion was relaxed. Preserved evidence: `test-results/epics/E20/perf/l2-{high,low}.json`, `*-before-contact-cache.json`, and `*-main-17fc6b7d.json`.

## T-E20-13 regression

The prerequisite's `SUPERSEDED` list used generated numeric placement IDs. Regenerating D-GROVE shifted their suffixes by four, leaving three fences across the intended cluster exit and removing different fence segments instead. Retained main commit `8ce45e27` matches asset and position, preserving the intended escape opening.

Controlled replay of the exact prerequisite `0380984e`, changing only that lookup (not the driver, civilians, sedan positions, bot or criterion):

| Seed | Prerequisite cluster kills / 13 | Lookup fix kills / 13 | Completion before → after |
| --- | ---: | ---: | ---: |
| 1 | 6 | 0 | 142.07 → 122.13 s |
| 2 | 4 | 0 | 157.65 → 126.55 s |
| 3 | **7 (fails)** | 0 | 149.82 → 124.12 s |

Every comparison retains the 19.45 s legacy ride. This isolates the layout lookup as a cause of the extra fighting, including a failing seed; the original reported 13/20 rate was not replayed across all 20 old seeds. The final lane's complete battery meets the unchanged limit on **20/20** seeds. Diagnostic records: `test-results/epics/E20/cluster-prerequisite.json`.

## Visual review

Reviewed the game-camera turn at frames 160 and 320, the matching top view at 320, and full-route frames 220 and 1000. The long chassis changes heading along the junction arc, with visible clearance from the red sedan and pavement furniture. The elderly pedestrian walks to the pavement before the engine passes. On the straight sections the engine keeps the same right lane; the near-side tyres rest on the asphalt. The front wheel shows steering during the apron approach. The real-input ride frame also shows the truck centred on the right lane, with visible tyre contact and an unobstructed pedestrian across the junction. The full ride's station paving-edge sink was caught by the 0.5 cm gate and corrected by rechecking the wheel contacts after settling.

Scene fixtures: `tests/scenes/qa-l2-truck-drive-{game,top,full}.json`. Metrics and original PNGs are in `test-results/scenes/`; small JPGs are copied to `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/l2-truck/`.

## Validation and limits

- `npm run typecheck`, `npm run lint`, `npm run build`: passed in the final E20 verify preflight.
- `sh /Users/wesner/Workspace/minorincident/tools/remote/run.sh "$PWD" --pull test-results/epics/E20/unit-contact-cache.json -- npx vitest run tests/unit --maxWorkers=2 --reporter=default --reporter=json --outputFile=test-results/epics/E20/unit-contact-cache.json`: after the contact cache, 99 files / 352 tests passed (134.17 s). The earlier Mac unit run also passed 352/352.
- `E2E_PORT=3358 SIM_WAIT=60 npm run test:smoke`: 6 sim tests and 25 browser tests passed.
- `E2E_PORT=3359 npm run test:e2e -- tests/e2e/levels/L2.spec.ts --workers=2`: 2 passed, including T-E20-18 real-input playthrough and T-E20-14b campaign carryover. The real-input run reaches progression in 155.82 s, with 0 kills, 22 knockdowns and 1 death.
- Remote `npx vitest run tests/levels/L2-boarding.test.ts --maxWorkers=2`: **3 passed** (186.55 s), including 20-seed one-click rack and ring regressions.
- Final functional browser coverage: **29/29 passed**, combining 18 runner checks, seven native replacements for SwiftShader/pixel/long-input failures, the native T-E20-18 playthrough, and three runner WebKit checks. Original runner attempt: 18 passed / 10 failed (timeouts, a software WebGPU error, and three Chromium-flag WebKit launch failures). Raw results are retained; `playwright-combined.json` records the final source for each selected case.
- Native rerun: `E2E_PORT=3362 sh tools/e2e-lock.sh npx playwright test tests/e2e/levels/L2.spec.ts tests/e2e/levels/l2-apron-alarm.spec.ts tests/e2e/levels/l2-axe-findable.spec.ts tests/e2e/controls-playtest.spec.ts tests/e2e/menus-mouse.spec.ts tests/e2e/crowd-drawn.spec.ts --project=chromium --workers=1`: eight passed; T-E20-18 exposed a snapshot race after the campaign had loaded L3. Commit `bbd6faf7` captures the actual completed L2 state in the same browser task as stepping. Its existing result/progression, gate and photo assertions remain. Targeted unchanged-title T-E20-18 rerun: **1 passed**, 155.82 s sim time, 0 kills, 22 knockdowns, 1 death.
- WebKit runner rerun: `npx playwright install webkit`, install its system dependencies, build, then `npx playwright test tests/e2e/audio/smoke.spec.ts tests/e2e/smoke.spec.ts --project=webkit --grep @smoke --workers=2`: **3 passed**. Commit `812c2dcf` keeps Chromium-only ANGLE flags out of WebKit.
- Native T-E20-20 final source: **0 passed / 2 failed**, with the unchanged budgets and the measurements above.
- Standard E20 verification with the offloaded sim and host-partitioned browser results: sim pending; performance gates fail.

Mac validation before the runner instruction used `tools/sim-lock.sh` / `tools/e2e-lock.sh`, with at most 2 workers and private ports (Scene Lab 3341, E20 3357/3359, smoke 3358). Remaining heavy runs moved to the Hetzner runner using the absolute `tools/remote/run.sh`; no Mac locks run on the remote host. Pixel/visual checks stay on the Mac with headless ANGLE/Metal. Remote functional browsers use headless SwiftShader. The requested unit command uses 2 workers instead of 3 to follow the crash-recovery machine-load constraint. No push, deployment or merge into main.

The station apron is explicitly excluded from street lane-centre measurement. Junction lane-centre measurement uses the tangent connectors between the independent street lane centres. No blockage-pass exemption is used. Persistent obstacles hold the engine; they are not moved, hidden or despawned to finish the ride.
