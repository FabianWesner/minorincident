# L8 threat baseline and remaining acceptance work

The comparison used detached main `540ab32a`. Its L8 threat audit had zero L8 flags (plus `PARTIAL_LEVEL_SELECTION`). Commit `b8379aea` restores the lane to zero L8 threat flags while retaining the G-16 and G-21 fixes from `34572dd9`. The temporary main worktree was removed.

| Row | Before, low / high | Current, low / high | Status |
|---|---|---|---|
| G-16 | Rocket missing / rocket missing | Exact opening set including rocket / same | Pass; surrender occurs at breach |
| G-21 | Lion, gorilla, elephant rack and follower restore mismatch / same | All 15 checkpoint clauses pass / all 15 pass | Pass |
| G-22 | Breach first windup 75.75 s / 70.05 s; low reinforcements had insufficient admissions | Complete breach 13 admitted, 85.45 s / 25 admitted, 84.10 s; low reinforcements at 1920, 2640, 7103, 18508 admit 2 each and have no windup within 20 s | Open |
| L8-06 | 14.29% / 0% | 0% / 0% | Open; target ≥90% |
| G-13 | Worst ratio 0.847 / 0.910 | Worst ratio 0.941 / 0 | Open; target ≥0.95 |

The high worst bounded path sample at tick 9240 has infected 486 at (30.77, 29.61), player (54.57, 38.74), and the zebra fight armed. A native path probe found the actor physically clear and not pending admission, with no path to the player; the active zebra entry is closed. The low worst sample at tick 8160 has infected 481 at (-0.85, 39.55), player (22.31, 23.83). The same native probe found that actor physically clear, not pending admission, and without a path; the primate arena was complete and zebra had not started. A path that remains open through later encounters is required.

Opening active encounter entries moved the high worst sample to the elephant yard and caused an L8-02 failure; that variant was reverted. Direct authored pursuit for the initial breach improved the passive first windup to 25.45 s, but produced `WAVE_FIRST_ATTACK_OVER_20_SECONDS` and `SLOW_FOLLOWER:354`; it too was reverted. The committed state retains main's gate and AI behavior. The L8 follower controller still needs a movement correction for the slow individuals; the high receipt records five near-stationary rescued followers.

Routing allied survivors through the L8 follower controller in isolation was also measured and reverted: the threat audit then reported slow-follower flags for IDs 381 and 386 in both escape and breached phases. That result rules out retaining that broad controller change as the zero-flag fix.

Both `qa:accept` tiers were run on source hash `8a207b1893cab0f02a2d39c5dfaec911d69732d71aa0aa0856f971aa675c253d`: each reports L8-06 failing, with browser-dependent rows incomplete. Global receipts contain the G-13 and G-22 failures above. The threat audit on this source reports zero L8 flags; its only flag is the partial level selection notice. Typecheck, lint and the existing focused save progression test (7 cases) pass. Acceptance-generated `fix51-verify` files were not committed.

Changed files in the baseline restoration: `src/data/l8Bosses.ts`, `src/levels/L8/layout.ts`, `src/render/L8Gates.ts`, `src/sim/ai/InfectedSystem.ts`, `src/sim/missions/L8BossArenas.ts`, `src/sim/missions/LevelEightZoo.ts`, and `src/sim/outbreak/Allies.ts`. The retained G-16 and G-21 implementation and test are in the preceding commit. Open work is to repair the cohort, enclosure paths and follower pace while preserving the zero-flag threat result, then remeasure both tiers.
