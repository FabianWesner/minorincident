# L2 required axe and continuous objectives

PO requests (2026-10-10): make the fire axe prominent, require its pickup, ring the alarm when taken; fix the missing radar/HUD goal after the outbreak.

## Changes

- The first objective is “Take the fire axe”. The pickup is required before boarding, selects the axe using the existing loadout, and emits `l2.alarm` immediately. The automatic 20–30 second alarm is removed.
- The existing yellow rack diamond and floor ring highlight the pickup. The floor ring follows the 1.5 m interaction radius and sits above the 0.4 m apron. The axe is shifted within its pale rack to clear the protective bollard.
- The checkpoint objective activates as soon as the doors objective completes. Previously all current objectives completed while `bridge` waited for the radio trigger (up to 45 s after doors-open, or moving 25 m away). That gap removed both the HUD text and radar objective pin, including in the saved `doors` checkpoint. The radio dialogue retains its existing timing.
- The menu replay driver takes the pickup through actual mouse/keyboard input even when the saved campaign already owns the axe. The old `no-axe` bot now takes the required pickup and switches to its bat for escape. Bot drivers survey the station before picking up the axe, preserving their existing seeded human pacing; the player can take it immediately.
- The browser mouse driver reframes projected points covered by HUD controls before clicking, avoiding accidental weapon cycling while travelling or fighting. Existing mission/completion assertions are retained.

## Specification deviations

The newer PO request supersedes E20’s optional-axe and timed-alarm expectations, and its radio-gated escape objective. `specs/` is unchanged by this lane. Weapon damage is owned by the parallel `axe-stronger` lane and is unchanged here.

## Validation

| Check | Result |
|---|---|
| Typecheck, lint, production build | Pass on final source |
| Full remote unit suite | 453 passed |
| Full remote sim suite | 488 passed, six existing skips, after isolated timing retry |
| New alarm/continuous-objective sim tests | 2/2 passed, including 120 s idle and doors restore |
| Final-policy rerun | 4/4 passed: new regressions, completion-time band, checkpoint restores |
| Focused native headless browser | 5/5 passed, including real-input L2→L3 and menu replay |
| Remote sim smoke | All six selected checks passed |
| Full native level browser suite + browser smoke | 31 passed, three travel failures (L1, L2, L3); L2 pickup, alarm, replay, rescue, and campaign handoff passed |
| Merge of current main | Clean merge of `d27704a2`, including parallel axe damage and character size changes |
| Post-merge L2 node/integration checks | 31 passed, three existing battery failures: completion time and two survival criteria |
| Post-merge escape checkpoint/respawn tests | 2/2 passed |
| Post-merge L2 browser reruns | Running |

The full unit/sim suites above were run before merging `d27704a2`; the merged-source node run covers the new mission regressions and the parallel damage/character changes. An additional full unit rerun could not start because the selected runner ran out of disk space while copying its private job.

Evidence is in `test-results/l2-axe-objective/`: `browser.json`, `sim.json`, `final-policy.json`, and `final-suite-summary.json`. The fresh full unit/sim run initially passed 939 tests, skipped six, and missed two 4 ms performance thresholds (director p95 4.026 ms; horde p95 5.087 ms). Both complete timing test files passed all 12 checks when retried with one worker and both runner slots reserved. The combined result is 453 unit and 488 sim tests passed, with six skips. Raw results are retained in `final-unit-sim.json` and `timing-retry.json`; `final-source-check.json` records that all 840 source/test/tool TypeScript files matched the local final source.

The broad E20 exploratory run records 34 passed and five failed with a discarded shorter-cover driver. Returning to the original escape policy clears its completion/checkpoint failures. Its final completion time is 207.83 s (existing band 105–210 s), with two deaths (existing survival limit one).

Controlled main `98e9aa79` checks reproduce the broader problems: its unchanged complete policy takes 292.12 s with four deaths, and its civilian-fate test fails on seed 1 with two evacuees still outside the checkpoint. See `main-comparison.log`, `main-fates.json`, and `final-bot.json`. Those measurements establish pre-existing broader battery failures; assertions and weapon damage are retained. `npm run verify -- E20` therefore does not pass the full battery.

After merging newer main `d27704a2`, the 34-check node/integration rerun passes 31 checks, including both new regressions, all pickup/boarding interactions, checkpoint restores, civilian fates, and the parallel damage/character tests. Its remaining failures are T-E20-02 (248.57 s versus 210 s), T-E20-03 (newbie two deaths versus one), and T-E20-09 (complete two deaths versus one). The previously failing civilian-fate check now passes. `merged-l2-node.json` records the result; the older controlled-main measurements above precede the parallel damage and character changes.

The Linux SwiftShader browser attempt was stopped after loading/render timeouts in unrelated L1 tests. A second software run could not synchronize because the selected runner's disk was full. Final browser validation uses native Metal, headless, two workers, under the shared e2e lock.

The full native run is retained in `all-levels-native.json`. Its L2 travel failure occurred after pickup, alarm, and doors-open objective assertions passed; the HUD snapshot still showed “Reach the police checkpoint at the bridge”. The earlier focused real-input run completed L2→L3. The subsequent driver correction and main merge are being checked in the post-merge reruns.

## Camera review

Inspected `test-results/l2-axe-objective/start.png` (1600×900, actual follow camera, WebGL2 on Metal, headless). The red axe head and wood handle are fully visible against the dark board with its pale border, to the right of the bollard. The bright yellow floor circle is visible above the paving in front of the rack, with the objective diamond above it. Engine 3 occupies the foreground without hiding the rack or ring. The HUD reads “Take the fire axe · 3 m”, and the minimap carries the objective pin. The approaching firefighter overlaps part of the ring, but most of the circle remains visible. Also inspected the close follow-camera capture `rack-close.png`: the full red head and handle are readable on the rack, the large yellow ring is unobstructed over most of its circumference, and the HUD identifies the pickup at 0 m.

The inspected doors-open capture (`test-results/l2-axe-objective/outbreak-goal.png`) shows the checkpoint goal text and its orange radar pin while the doors-open dialogue is still playing, before the fallback radio call.
