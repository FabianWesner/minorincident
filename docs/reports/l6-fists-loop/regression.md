# L6 fists fetch/bring regression

The controller comparison isolates `d85d22d84` as the first bad change for a returned survivor following the courier back into another fetch. That change widened rejoining from the tail to the column, but bounded the column with the **scripted leader**. A group displaced ahead by combat could have its real tail beyond that upper bound. A collected survivor back among those walkers remained collected, followed the courier away again, and interrupted the next fetch with another bring request.

`5b7037e83` uses the actual walking column's head for the upper bound, retaining the earlier long-column fix. It changes no infected count, damage, movement speed, L5 code, objective completion, or checkpoint eligibility.

## Level regression

`tests/levels/l6-weapons-flow.test.ts`: "a returned straggler rejoins the real column before the courier fetches the next one, even when the leader is held behind it".

The fixture starts the leader held at gate 90, with a combat-displaced column ahead, a collected survivor returned to that column, and another injured survivor behind. The regular civilian threat response keeps the column moving away from its last threat. The courier walks back for six seconds using ordinary input. Before the fix, `waitFor` switches from fetching survivor 20 to bringing survivor 15 again. After the fix, survivor 15 remains rejoined and the next fetch remains active. No god mode is used.

The same test and surrounding tree were used for each comparison; only `LevelSixSubway.ts` was read from the named historical revision. Each invocation was a new Vitest process with `--maxWorkers=1`. The original source was restored after the comparisons.

| Controller revision | Result |
| --- | --- |
| `56d7e7d16` (main baseline) | pass |
| `cd5ce5b31`, `517522ec2`, `dfe8bb0db` (initial boundary check) | pass |
| `4bbef64b2` (last predecessor) | pass |
| `d85d22d84` (first bad) | fail: expected fetch 20, received bring 15 |
| `54e86bba2` (starting branch tip) | same failure |
| `5b7037e83` plus the final movement regression | all 11 weapons-flow level tests pass |

The adjacent logs contain the final movement test's main, last-good, first-bad, starting-tip and fixed results. This comparison did not require a baseline worktree.

## Real-input driver

A diagnostic male fists L5→L6 run reproduced repeated gate-90 fetches and shelter retries before the final driver changes. A full live mission snapshot was captured for investigation. A separate sim replay could finish that state on both main and the branch; the real-input driver's combat was therefore investigated as well.

The old driver used Space for unarmed combat and a fixed 18-pixel offset above the enemy's ground projection. Space can keep the kick selected; the fixed offset does not track a drawn lunge or fall across zoom settings. The driver now clicks the rendered chest, only considers rendered enemies inside the viewport, retries a click after one second without damage, and retains its low-health retreat. All combat still uses physical mouse/keyboard input and visible body poses. Additional mission observations are written only as diagnostic evidence, never used to decide input. Final death counts are read from the mission's accumulated statistics so a missed dead frame does not undercount them.

Final playtest and suite results are recorded separately after completion; the controller comparison alone does not establish a completed playthrough.

### Pose-probe validity guard

`CrowdFigureProbe` requires the presence of the `test` query key. `testApi=1` alone does not populate it. An initial candidate run with an empty enemy list was rejected after its result showed no combat; it is not completion evidence. The driver now uses `test=poses` to enable render observations while retaining the production clock, UI and prewarming paths (those check specifically for `test=1`). It fails immediately if L6 has no rendered-body observations. Per-level counts of actual player `combat.attack` events are saved in the run JSON, and the final audit requires fist attacks in the fists run and firearm attacks in both weapons runs.
