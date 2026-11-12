# S79 L8 final boarding — fix verified; acceptance HOLD

Date: 2026-11-12. Baseline: `c9a9bbbd`. Branch: `lane/s79-l8boarding`.

## Root cause and correction

The HIGH zoom 1 physical-input route reproduced s78: after the elephant died, the courier remained at `(95.4, 53.2)`, 22 m from the APC, while the HUD said `Cover the survivors while they board · 0/14 aboard`. The driver reported no navigation marker. The yellow ring visible at the APC was the destination; the earlier interpretation that the courier was already there was incorrect.

`LevelEightZoo` hid the waypoint and switched to the cover instruction immediately after the final animal cleared. Boarding only activates when the courier approaches within 12 m of the driver door. The instruction therefore removed route guidance before the courier reached the pickup. This explains why the native boarding fixture, which already placed the courier at the APC, passed while the real-input route stalled.

Commit `1a78339b` retains `Lead the group to the armored vehicle` and the waypoint until boarding activates. Once all passengers seat, commit `2a2d77c4` changes the instruction to `Board the armored vehicle · 14/14 aboard` and restores the driver-door waypoint. The intermediate cover phase retains its boarding counter. No corpse, collision rule, zombie stat, gate, or threat-audit code was changed.

## Current evidence

| Requirement | Evidence | Result |
|---|---|---|
| Five seeds × four elephant corpse positions; 14/14 within 60 s | [Native matrix](native-matrix.json), `tools/qa/l8-boarding-matrix.ts` | 20/20; 30.38–35.49 s; corpse retained; entry gate physically closed; zero solid-registry failures |
| Real-input HIGH zoom 1 from before elephant through boarding | [Boarding timing](browser-boarding.json), `test-results/playtest/s79-fixed-elephant/` | First post-kill objective tick 1299; 14/14 tick 3263; 32.73 s |
| Full final approach and departure on final correction | [Completed input run](completed-input.json), `test-results/playtest/s79-driver-door/` | L8 completed and L9 entered in 67 s; zero deaths, assists, skips, or driver issues |
| s77 route confinement | `node --import tsx/esm tools/qa/l8-gate-shoves.ts` | 432 gate shoves; 16 route edges; 10 corner shoves; zero escapes |
| Typecheck and lint | `npm run typecheck`, `npm run lint` | Passed after final driver-door correction |
| Remote unit suite | Unchanged `sh tools/remote/run.sh "$PWD" -- npm test` | Passed after first guidance correction: 27 files, 106 passed, one skipped, 204.4 s against 240 s; final driver-door objective change additionally has typecheck/lint and successful real-input coverage |
| Zero raw L8 threat flags | Unchanged `node --import tsx/esm tools/qa/threat-audit.ts --levels L8` | **Not met**; baseline and corrected source have the same skilled reachability flag |

The matrix is a protected motion fixture after combat: passengers start inside the yard, the courier at the pickup, and the persistent elephant corpse is placed at the yard centre, entry gateway, yard gate, or north exit. It proves follower egress and boarding under those conditions, not combat victory. Real-input runs separately prove the approach after an actual elephant kill.

## Opened visual evidence

[Before/after sheet](boarding-sheet.jpg): left is the reproduced 0/14 stop, with courier/group inside the yard and destination at the APC; right is the fixed 14/14 state, with the yard crowd cleared and the elephant corpse retained beside the truck. Both original captures and the sheet were opened. The final-run `campaign-L8-result.jpg` was also opened: it shows the `Level 9 · The Crossing` loading screen, corroborating the completed handover. One small sheet is retained in this report.

Browser runs were headless, HIGH zoom 1, through the browser pool on unique port 4981. The final two runs used `tests/fixtures/saves/qa/l8-before-elephant.json.br` only for initial state; subsequent actions used physical keyboard/mouse input. Initial sandbox/socket failures were superseded by these successful runs.

## Remaining acceptance failure

The raw skilled receipt contains `step/escape:UNREACHABLE_SHARE_OVER_30_PERCENT_FOR_OVER_20_SECONDS`. The console's zero-passive-flags summary does not establish zero raw L8 flags. The separate top-level `PARTIAL_LEVEL_SELECTION` flag is merely the scope label for selecting L8.

A fresh audit using the original `c9a9bbbd` mission file reports `sourceMatchesMain: true` and reproduces the same skilled flag: 142 blocked seconds, tick 24478, courier `(91.968063, 72.316887)`. See [baseline receipt](threat-baseline.json). Most ordinary infected are behind previously sealed route cells while the courier is at the APC. The correction was restored in a `finally` block; no baseline source edit remains.

Existing tunnel routes spawn new actors rather than moving the same trapped actors. Shared vaulting handles low sandbags, L4 wire, and limited leaper climbs; it does not cross L8's 3 m solid gates. Clearing this baseline failure requires further physical route/gate design while preserving s77 confinement. A scope decision has been requested. No check was loosened, and the goal is not marked complete.

All work is committed locally. No push, deployment, or main-branch movement was performed. No checks remain running.
