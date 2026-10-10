# L2 required axe and continuous objectives

PO requests (2026-10-10): make the fire axe prominent, require its pickup, ring the alarm when taken; fix the missing radar/HUD goal after the outbreak.

## Changes

- The first objective is “Take the fire axe”. The pickup is required before boarding, selects the axe using the existing loadout, and emits `l2.alarm` immediately. The automatic 20–30 second alarm is removed.
- The existing yellow rack diamond and floor ring highlight the pickup. The floor ring follows the 1.5 m interaction radius and sits above the 0.4 m apron. The axe is shifted within its pale rack to clear the protective bollard.
- The checkpoint objective activates as soon as the doors objective completes. Previously all current objectives completed while `bridge` waited for the radio trigger (up to 45 s after doors-open, or moving 25 m away). That gap removed both the HUD text and radar objective pin, including in the saved `doors` checkpoint. The radio dialogue retains its existing timing.
- The menu replay driver takes the pickup through actual mouse/keyboard input even when the saved campaign already owns the axe. The old `no-axe` bot now takes the required pickup and switches to its bat for escape. Bot drivers survey the station before picking up the axe, preserving their existing seeded human pacing; the player can take it immediately.

## Specification deviations

The newer PO request supersedes E20’s optional-axe and timed-alarm expectations, and its radio-gated escape objective. `specs/` is unchanged by this lane. Weapon damage is owned by the parallel `axe-stronger` lane and is unchanged here.

## Validation

| Check | Result |
|---|---|
| Typecheck, lint, production build | Pass on final source |
| Full remote unit suite | 453 passed |
| Full remote sim suite | 487 passed, six existing skips |
| New alarm/continuous-objective sim tests | 2/2 passed, including 120 s idle and doors restore |
| Final-policy rerun | 4/4 passed: new regressions, completion-time band, checkpoint restores |
| Focused native headless browser | 5/5 passed, including real-input L2→L3 and menu replay |
| Remote sim smoke | All six selected checks passed |
| Full native level browser suite + browser smoke | Pending shared GPU queue |

Evidence is in `test-results/l2-axe-objective/`: `browser.json`, `sim.json`, `final-policy.json`, and `full-suite-summary.json`.

The broad E20 exploratory run records 34 passed and five failed with a discarded shorter-cover driver. Returning to the original escape policy clears its completion/checkpoint failures. Its final completion time is 207.83 s (existing band 105–210 s), with two deaths (existing survival limit one).

Controlled main `98e9aa79` checks reproduce the broader problems: its unchanged complete policy takes 292.12 s with four deaths, and its civilian-fate test fails on seed 1 with two evacuees still outside the checkpoint. See `main-comparison.log`, `main-fates.json`, and `final-bot.json`. The broader newbie/death and civilian-fate criteria remain unresolved; assertions and weapon damage are retained. `npm run verify -- E20` therefore does not pass the full battery.

The Linux SwiftShader browser attempt was stopped after loading/render timeouts in unrelated L1 tests. Final browser validation uses native Metal, headless, two workers, under the shared e2e lock.

## Camera review

Inspected `test-results/l2-axe-objective/start.png` (1600×900, actual follow camera, WebGL2 on Metal, headless). The red axe head and wood handle are fully visible against the dark board with its pale border, to the right of the bollard. The bright yellow floor circle is visible above the paving in front of the rack, with the objective diamond above it. Engine 3 occupies the foreground without hiding the rack or ring. The HUD reads “Take the fire axe · 3 m”, and the minimap carries the objective pin. The approaching firefighter overlaps part of the ring, but most of the circle remains visible. Also inspected the close follow-camera capture `rack-close.png`: the full red head and handle are readable on the rack, the large yellow ring is unobstructed over most of its circumference, and the HUD identifies the pickup at 0 m.

The inspected doors-open capture (`test-results/l2-axe-objective/outbreak-goal.png`) shows the checkpoint goal text and its orange radar pin while the doors-open dialogue is still playing, before the fallback radio call.
