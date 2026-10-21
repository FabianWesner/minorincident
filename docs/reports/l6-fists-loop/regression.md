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

## Confirmed shelter-retry cause: global checkpoint guard

The live trace in `gate-loop-live.json` establishes another regression, introduced by **`2f25c41f7`**. At tick 13543 the leader is at x147.5, the healthy tail is x122.5, and every injured survivor is east of x94. Gate 90 still has no checkpoint. At tick 14039 the group is held at gate 150 and the unrejoined injured survivors are at x112.6/x114.2; gate 90 still has no checkpoint. The next death restores the shelter and the entire first-gate fetch sequence.

The condition used `!behind`, which means nobody may be behind the **current column**. It therefore withheld an earlier gate even when its stragglers had already crossed it. The fix checks for an unrejoined straggler **before the particular gate**. It preserves the healthy-column and living-majority requirements and the refusal to snapshot a straggler still west of that gate. It leaves the mid-tunnel checkpoint condition unchanged.

The new level test, "stragglers beyond a passed gate retain its checkpoint through deaths instead of restarting the shelter fetch loop", uses fists, places the retreat beyond gate 90 with injured people lagging behind the later column, and kills the courier twice. Both retries must use gate 90; the injured survivors remain unrejoined and the retreat objective remains active. Before the fix it restores `abandon` instead. No god mode is used.

| Controller revision | Death/respawn regression |
| --- | --- |
| `cd5ce5b31` (initial gate checkpoints) | pass |
| `cbae916ad` (parent of the checkpoint guard) | pass |
| `2f25c41f7` (first global guard) | fail: abandon instead of gate-90 |
| `54e86bba2` (starting branch tip) | same failure |
| Corrected guard plus real-column rejoin fix | all 12 weapons-flow level tests pass |

This test checks the added gate-checkpoint behavior; main `56d7e7d16` predates those checkpoints. The separate rejoin regression above also passes on that main baseline. All existing gate-checkpoint assertions remain; the older test title now says "before that gate" to describe its unchanged fixture and expectations.

### Unarmed crowd inputs

The valid stationary-target diagnostic stopped after 665 s with 8 deaths and 329 fist attacks; its `aborted-L6.json` records that unfinished run. In unarmed L6 crowds of at least three visible enemies within 3 m, the driver now uses the shipped K/right-hand kick in short pulses and continues following the visible objective between pulses. This crowd movement takes priority over backing away from just the nearest enemy. Individual fights retain target clicks and the smaller-fight low-health backoff. Keyboard attacks aim at the ground projection; target clicks aim at the rendered chest. The crowd policy only runs when the visible inventory contains fists/kick alone, so it does not change armed runs or L5's combat policy.

## Gate-panel fixture corrections

The broad E24 browser selection exposed stale QA staging, independently of the real-input runs. The open gate uses a 1.7 m stand zone around `(92.4,17.3)`, while the closed gate uses its repair zone around `(90,15)`. The old courier placement `(91.3,15)` was 2.55 m from the open stand zone and could not close it. The fixture now uses `(91.2,16.15)`, 1.662 m from both centres. All panel text, meter-count, viewport-bound, gate-health and frame assertions are unchanged.

The Scene Lab gate composition also stages its leader at gate 90 rather than already beyond it, then advances one simulation tick after relocating the cast. This initializes frame-zero guidance for that staged column. The diagnostic probe observes the open panel at frame zero, a normal 60-tick closure, and the closed panel through the damage frames. These are QA compositions; they do not supply playthrough evidence or change production gate ranges.

### Keep the passing armed policy separate

A candidate that applied the unarmed chest-click/retry policy to guns was discarded after repeated exit retries: a guard stayed near the shelter and the courier died while returning. That unfinished attempt is not acceptance evidence. The final driver retains the branch's original firearm policy: a single physical click 18 screen pixels above the target's ground projection, held until the target changes. Rendered-body and viewport checks remain mandatory. This armed-only branch does not change the unarmed crowd inputs.

With that policy restored, the male seeded weapons run finishes in 283 wall seconds with zero deaths, zero skips and 293 actual machine-gun attacks. Its full record is in `weapons-male/`. This input comparison does not claim a separately isolated cause for the discarded guard's movement.
