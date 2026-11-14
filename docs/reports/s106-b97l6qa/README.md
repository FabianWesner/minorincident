# s106 — batch 97 L6 browser QA

Reviewed revision `8491f57919a4698dc523178c17a21a05271a7f75`. **Courier pressure is present, survivors are still attacked, but a >20 s player-pressure lull remains on the LOW exit approach.** The physical driver saved very few survivors and repeatedly died. This report does not reproduce the native typical-policy saved-share improvement.

## Method and completed routes

Production QA build (`MI_BUILD_CACHE=off npm run build:qa`), headless Chromium with Metal WebGL2, 1280×720, one browser through `tools/e2e-lock.sh` / shared pool, ports 4961/4962 and reservations ≤600 s. All HIGH attempts preceded LOW. Keyboard/mouse input throughout; **no god mode, teleport, simulation stepping, objective skips or gameplay edits**. Standalone L6 debug entry supplies the ordinary 29-survivor roster. These are automated physical-driver outcomes, not estimates of human or native-bot skill.

| Tier / zoom | Complete | Saved | Player deaths | Sim seconds | Fight RAF p95 | Samples |
|---|---:|---:|---:|---:|---:|---:|
| HIGH / 1 | Yes | 1/29 | 13 | 419.77 | 16.7 ms | 22,794 |
| HIGH / 1.5, waypoint | Yes | 3/29 | 9 | 363.65 | 16.7 ms | 19,549 |
| LOW / 1 | Yes | 1/29 | 8 | 327.65 | 16.8 ms | 17,278 |
| LOW / 1.5 | Yes | 1/29 | 2 | 212.60 | 16.7 ms | 10,485 |

Two earlier HIGH/1.5 attempts reached the exit but timed out at nine minutes: the driver stayed near `(249.4,11.2)` beside the stair approach. One had three survivors already out. A temporary QA-driver waypoint moved toward `(248,15)` before the exit marker using physical WASD, which completed the route. This is a disclosed map assist. The passive attack-start logger and driver edits were restored before committing. Original failed attempts remain in JSON. Their P0 `cannot-finish` labels are driver outcomes, not established game softlocks.

The routes cover shelter, first breach, second breach/shelter failure, gate closing and column retreat, and the night finish. Frame measurements use the existing fight observer, excluding intentional photo pauses and requiring advancing simulation ticks; they are diagnostic on this Mac near 60 Hz, not an exclusive hardware qualification.

## Pressure, oddities, and PO questions

**Infected visibly pressure the courier and still reach survivors.** The reviewed HIGH retreat image shows a dense mixed crowd around the courier/column, low courier HP and a survivor-loss banner. LOW has a visible “Survivor under attack! Turn back!” warning at the gate. The HIGH waypoint ledger records 183 player windups and 143 follower/group windups; LOW/1 records 303 player windups. Survivor losses and follower attack starts contradict complete survivor immunity. The opening can attack survivors while the courier is farther away.

**What looks odd:** crowd silhouettes and health bars overlap heavily in the narrow HIGH retreat. Player-centred clumping is visible and makes individual victims hard to read. No adjacent-survivor walk-past, circling loop, or target-switch jitter was established by the reviewed stills and telemetry; fast switching is not visually cleared by this sampling method. The earlier “enemy-unhittable” and “enemy-frozen” driver warnings are retained, but without a controlled reproduction they are unconfirmed. Corpses/downs are visible along the route; no corpse-removal or stat change was made.

**Boring / harmless / babysitting:** the post-door retreat is dangerous in these routes, not harmless: many player attack starts, damage and deaths continue. Nevertheless, LOW/1.5 has an exit-approach lull over 20 s. Repeated “group waits / cover the rear” instructions and return-to-group work can feel like babysitting, while the dense HIGH crowd makes protection difficult to read. The shelter's quiet opening is intentional; the driver's 20 s `stuck-navigating` warning there is a false positive because the scripted breaches follow normally.

PO history: “After I closed the first door, no more Zombies attacked the group, which made the game boring from there on”. **The absolute no-more-attacks regression was not reproduced**, but the LOW late-retreat/exit lull prevents a clean no-lull signoff. These runs are not a PO taste approval.

## Attack starts per 30 seconds

Counts below are player-target windup starts (including interrupted attacks), not resolved hits. Windows start at simulation tick 0; the last window is partial. First gate closure: HIGH waypoint tick 6583 (109.72 s), LOW/1 tick 8245 (137.42 s), LOW/1.5 tick 6787 (113.12 s). Checkpoint deaths and restored encounters remain in the timeline. The first HIGH/1 route has step totals but no timestamp logger; its per-window counts are unavailable and are not reconstructed from strike counts.

| Run | Consecutive 30 s windows from level start |
|---|---|
| HIGH / 1.5 waypoint | 0, 1, 36, 12, 19, 12, 14, 22, 17, 14, 15, 21, 0 (partial) |
| LOW / 1 | 0, 0, 94, 46, 18, 22, 15, 21, 43, 23, 21 (partial) |
| LOW / 1.5 | 0, 28, 7, 9, 22, 20, 17, 0 (partial) |

No >20 s post-first-closure player-start gap was found in the timestamped HIGH waypoint or LOW/1 route. LOW/1.5's last player start was tick 11129 (185.48 s), during retreat. Exit begins at tick 11798. The last sampled non-done tick is 12420 and first done sample 12480: **at least 21.52 s and at most 22.52 s without a player attack start before completion**. The raw 26.52 s tail in JSON includes done-phase sampling and must not be used as the gameplay lull duration.

## Findings and reproducers

- **P1 review concern — poor protection outcomes under real-input driver.** Run standalone L6, HIGH zoom1 or1.5 with the ordinary physical playtest driver, cover the retreat and finish. Observed 1/29 with13 deaths and3/29 with9 deaths. LOW saved1/29 at both zooms. Driver limitations and repeated checkpoint restoration are substantial confounds; this is not proof that the 6 m preference itself causes the losses. Reproduce with human play before tuning. No tuning is proposed here.
- **P2 — LOW late pressure lull.** Standalone L6 LOW zoom1.5, physical route with exit stair waypoint; after first gate closes at6787, last player windup11129, retreat→exit11798, still playing at12420. Expected review target: no >20 s post-closure lull. Actual ≥21.52 s. See exact attack events and phase samples in JSON.
- **P2 — crowd readability.** HIGH zoom1.5, retreat around tick5423: courier, infected, survivors and several bars overlap in the narrow track; inspect the centre panel of the contact sheet. This makes the protection target difficult to distinguish.
- **QA-tool issue — exit navigation.** Original HIGH zoom1.5 driver follows a bearing into the stair-side obstruction near249.4,11.2 and times out. Physical intermediate waypoint resolves it. Retained separately from gameplay findings.

## Evidence and checks

[Opened contact sheet](contact.jpg) contains six reviewed panels. [Evidence JSON](evidence.json) retains all six attempt summaries, exact logged attack starts where available, per-window counts, frame counts/p95, issues, source receipt hashes and initial infrastructure failures. Raw captures/receipts remain under ignored `test-results/s106-l6qa/`. The report contains one small sheet; no gameplay or QA-tool change is committed.

`npm run typecheck` and `npm run lint` passed. Full requested remote command `sh tools/remote/run.sh "$PWD" -- npm test` passed unchanged: collection150/150 cases, runtime106 passed/1 skipped,27 files,223.7 s within240 s, remote exit0. The initial sandbox cache/socket/process restrictions were resolved before browser work. No deploy, push or main movement was performed.
