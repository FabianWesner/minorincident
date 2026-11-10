# r32-l9fun: L9 driving fun and real fight action

Lane r32-l9fun (claude-opus-5-5), 2026-11-10/11. Based on main 934225f0; main merged twice (last: bd86a1eb, incl. r32-alphas).

PO request (verbatim, 2026-11-10 ~23:30): "And make sure L9 has some driving fun, incl jumps etc and some real fight action not just dumb zombies."

## What changed

**Set pieces** (`src/sim/missions/LevelNineSetPieces.ts`, data `l9SetPieces` / `l9SetPieceTuning` in `src/data/l9.ts`). Each fires once when the APC passes `atX` on any route. It is staged ~112 m ahead on the lane the APC is actually driving (route line or detour, so the safe detour driver meets them too), outside the driving frame. It uses the L9 Alpha types (leaper, thrower) and existing archetypes only, with no infected stat changes. State lives in the L9 mission snapshot, and `restore` rebases its ticks.

| id | trigger x | what happens |
|---|---|---|
| pack-1 | -500 | 6 dogs/runners/sprinter flank the lane and close on the hull |
| smash-1 | -450 | junk across the lane (bins, cones, mailbox, barricade) to plough through |
| leapers-1 | -300 | 2 Leaper Alphas crouch at the verge. When the hull comes within 17 m they telegraph (`alpha.pounce`, 30 ticks), then leap (34 ticks) to where the hull will be. A hit clings at the side rail (20 durability on landing, then 30 per 1.5 s, and bites an open hatch). Swerve or handbrake throws it off alive. A miss lands it in a knockdown. Up to 3 pounces each. |
| thrower-1 | -150 | Thrower Alpha at the verge, 4 throws (`alpha.grab-throw` telegraph with landing marker). Barricades and bins land 9 m ahead of the predicted hull (smash for 10). The 3rd throw is a concrete block (dodge) only when the APC is >= 7 m/s. A direct hit costs 30. |
| smash-2 | -60 | second junk line (just after the overpass jump and tanker) |
| roadblock-1 | 40 | 6 barricades across the lane, with 10 light infected behind them (runners, sprinters, screamer, crawler, dog) |
| pack-2 | 120 | second pack (meets the APC as the bus chase starts) |
| leapers-2 | 160 | 2 more leapers |
| thrower-2 | 200 | second thrower |
| stall-ambush | 265 | a leaper and a thrower wait where this lane crosses the railway. At the rail stall the leaper pounces onto the stopped hull, and the thrower saves its load for the stopped hull. Then a mixed rush of 6 (brute, armored, screamer, runners) arrives at stall +14 s, on top of the existing reinforcement waves. |

**Driving fun**
- **Jumps.** Three new ramps, for 5 in total: road overpass (-65) and wreck-pile (135); countryside embankment (-105) and creek-bank (115); shortcut ditch (80). They reuse the existing ramp plate, the collapsed landing block and the jump signal. Airtime (all four wheels off the ground) is recorded in `driving.airtime`. A landing below 7 m/s still costs 40. Flip recovery is the existing `recoverFlip`.
- **Camera.** The follow camera widens 12 % while the APC is in the air (`View.airborne`). It shakes on landing.
- **Wreck pile.** Crushed cars (`veh.wreck`) flank the wreck-pile landing. They are render only and sit outside the flight path.
- **Boost strips** on the long straights. Road: -280 and 230. Countryside: -230 and 225. Shortcut: -160. Each has painted orange bars across the lane and an "OPEN ROAD · FLOOR IT" board. Crossing one at > 4 m/s gives a 4 s engine boost (the existing `drive.boost`: 1.25 x top speed, 1.5 x force). The floor speed cap still applies. HUD: "Boost · open road, floor it".
- **Tanker near miss.** The leaking tanker now catches when the APC comes within 30 m. It goes up just after the APC has passed it (10 m beyond) or after 5 s. A scrape still blows it 2 s later. The slow motion of the existing blast lands behind the hull, and the HUD counts down "Get clear of the tanker".
- **HUD hints.** "Leaper on the hull · swerve hard or handbrake to throw it off" and "Thrower ahead · dodge the debris or smash through".

**Pacing.** The ambient patrol (a dumb pack every 8 s whenever nothing was in frame) now comes every 14 s (`patrolTicks` 840), because the set pieces carry the pacing. The authored groups, detours and counts are unchanged, so threat-proof L9-02 still holds.

**Small engine changes (shared, L9-only in effect).**
- `Obstacles.launch/smash`: a thrown obstacle has no collider and no contact until it lands. `Vehicles.impacts` and `floorContacts` skip airborne obstacles.
- `Vehicles.apcInfected` skips bodies in flight (`thrownBy`). Without this, the APC ran over and killed a leaper mid-pounce, and also killed thrown living missiles.
- The obstacle render follows `transform.y` (flight arc). Grounded obstacles are unchanged (y 0.5 → 0).

**Bots and tools**
- **LevelNineBot.** The risky driver takes the jumps head on, with a straight run-up and full throttle 45 m before the lip. It reads thrown concrete blocks like brutes, passes the tanker (near miss) instead of parking on it, and uses the MG at range and the shotgun close at the hatch. Key 7 was the rocket launcher, which L9 no longer carries since main 7c723c82. It eases into the evacuation bay at <= 0.35 x distance m/s. The old 0.6 x distance let the floor-speed APC orbit the bay at full lock and slip round the open end of the bridge-gate wall (seed 1, stuck for 7 min). If it overshoots inside the bay, it backs in.
- **`tools/qa/r28-vqa-fixture-play.ts`.** Driving now uses classic car keys: W gas, A/D steer to the goal, Space handbrake when boarders are on. It was still screen-relative WASD. A car reaches a route point within 8 m. It takes event shots of jumps and of leaper/thrower actions.
- **New tools.**
  - `tools/qa/r32-l9-timeline.ts`: beat timeline, gaps, durability at evacuation, damage by source, jumps.
  - `tools/qa/diag/l9setpieces.ts`: set-piece Alpha phases.
  - `tools/qa/diag/l9ramps.ts`: ramp lanes free of static solids. All five are clear apart from their own landing blocks; the overpass also has the tanker in its landing lane, as authored.
  - `tools/qa/diag/l9bay.ts`: bay approach trace.

## Beat timeline per route (skilled LevelNineBot, seed 1, low)

A beat is a mission signal (set piece, pounce, throw, jump, tanker, bus, stall …), a fresh infected arrival within 30 m (arrivals within 4 s count as one beat), a boarder grab, or a durability hit after 3 s without one. "Action" leaves out plain arrivals. Gaps are measured while the APC can drive; the stall and evacuation holds are fights in themselves. The before runs used the lane base (934225f0 + main 3cd62a69) with the same probe.

| run | before: done, s, durability at evac, action max/mean gap | after (HEAD) |
|---|---|---|
| road (detour; this is the threat-audit route) | yes, 200.1, 550, 20.6 / 6.8 s | yes, 245.8, 0, 15.3 / 1.8 s |
| countryside (detour) | yes, 209.3, 140, 17.5 / 3.8 | yes, 210.7, 440, 17.9 / 1.8 |
| road `--risky` (route line) | yes, 191.8, 63, 13.6 / 3.7 | yes, 265.1, 0, 17.9 / 1.6 |
| road `--zero` | yes, 412.2, 0, 30.9 / 3.1 | yes, 378.7, 0, 21.8 / 1.5 |
| countryside `--risky` | yes, 201.5, 270, 15.6 / 2.7 | yes, 212.8, 160, 17.8 / 2.0 |
| shortcut `--risky` | yes, 234.8, 0, 12.1 / 2.6 | yes, 221.0, 0, 11.1 / 1.5 |

The courier ended at 100 HP in every bot run, before and after; the bot's hatch policy kills boarders first. Boarder grabs went from 1–76 to 9–178 per run.

**Signals, road, before:** 40 Mega 1, 55 Mega 2, 72 Mega 3, 73 bus chase, 85 gate countdown, 103 rail stall, 133 restart, 145 gate closed, 152 evacuation. Between them: ambient groups and patrols only.

**Signals, road, after.** The `setpiece.*` time is when a piece is staged; the encounter comes about 8–10 s later.
- 5 pack-1
- 8 smash-1
- 37 leapers-1
- 41 Mega 1 (quiet)
- 46–48 two pounces, both land and are shaken off
- 50 thrower-1
- 56–60 throws
- 56 Mega 2 (quiet)
- 58 smash-2
- 60–65 tanker near miss
- 73 roadblock
- 79 Mega 3 (quiet)
- 80 bus chase
- 81 pack-2
- 84 leapers-2
- 88 thrower-2
- 92 gate countdown
- 94–96 pounces and throws
- 109–110 stall-ambush leaper pounce
- 111 rail stall
- 112–120 stall thrower: 4 throws, 4 hull hits
- 114–115 leaper on the hull, shot at the hatch
- 125 stall rush
- 141 restart
- 152 gate closed
- 176 evacuation

The countryside run has the same shape, plus the fire line at 50–65.

The road detour now reaches the floor (0 durability) before the bay; before, it arrived with 550. The extra damage comes from the thrower (120 at the stalled hull), the leapers (80), the roadblock barricades and the bus rams after the stall. The countryside run arrives with more durability than before (440 against 140), because the slower patrol cadence means fewer ambient contacts.

## Jumps (risky bot, real Rapier physics)

| ramp | airtime | speed at landing | landing |
|---|---|---|---|
| overpass | 62 ticks (1.03 s) | 13.6 m/s | clean |
| wreck-pile | 57 ticks (0.95 s) | 7.2 m/s | clean |
| embankment | 50 ticks (0.83 s) | 10.0 m/s | clean |
| creek-bank | 54 ticks (0.90 s) | 9.3 m/s | clean |

No flips and no hard landings occurred. The shortcut ditch was not jumped in the shortcut risky run: the bot reached it below lift-off speed after elephant contacts and the floor speed cap.

## Proofs, threat, tests (final HEAD after the main merge)

- **Driving proofs.** `l9-driving-proof`, low, seed 1:
  - road: completed, 245.8 s
  - `--risky`: completed, 265.1 s
  - `--route countryside`: completed, 210.7 s
  - `--zero`: completed, 378.7 s

  All four had 0 collision failures, 0 admission violations and the courier at 100 HP. Before this lane, `--zero` had 5 failures.
- **Skilled seeds** (road timeline): seed 1 at 245.8 s, seed 2 at 265.6 s, seed 3 at 210.7 s. All completed.
- **Threat audit.** `node --import tsx/esm tools/qa/threat-audit.ts --levels L9`: skilled complete at 245.82 s, passive complete, 0 L9 flags. The single fail flag is the usual L8-04 "not measured" row, because only L9 was selected.
- **Remote tests.** `sh tools/remote/run.sh … npx vitest run tests/engine/vehicles.test.ts tests/engine/missions.test.ts tests/engine/save-progression.test.ts tests/engine/infected-ai.test.ts --maxWorkers=2`: 4 files, 19 tests passed.
  - The new case `l9SetPiecesFight` is folded into the existing L9 floor-APC chain, so no new test case was added (150-case budget). It checks:
    - a leaper lands and clings above the road, and tears at the hull (2 or more hits);
    - a handbrake at speed throws it off, and it survives;
    - thrown debris becomes a road obstacle on the APC lane (z within 8 m) with a live collider, and only debris still in its flight is airborne.
  - A first remote run of the same files failed only in `zooParkedBoarding` / `checkL8Cues` (`breached` false). That also failed on main 6f3a9604 and was fixed on main by 56e762fb / 280156ee.
- `npm run typecheck`: clean. `npm run lint`: clean. `npm run test:gate` (remote): see the final report.

## Real play by keys (headless, one browser via `tools/e2e-lock.sh`, port 4915, `build:qa` + `vite preview`; preview stopped)

Captures are in `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r32-l9fun/`: `cap-road-low`, `cap-road-high`, `cap-wreckpile-high`, `cap-stall-low`, `cap-stall-high`. The contact sheet is `sheet.jpg` there; images are git-ignored in docs/reports.

What I saw in the opened frames:
- **Jumps** (road low s012/s013/s014/s019, high s002 and `cap-wreckpile-high/s002`): the APC is clearly airborne over the concrete landing block. Wheels hang and the shadow falls below. It lands clean, followed by "Get clear of the tanker · 5 s". In `cap-wreckpile-high` one crushed wreck at the landing edge is drawn see-through, because it is between the camera and the APC. The other two are out of frame.
- **Leapers** (road high s008, s006; low s006): a suit Alpha arcs onto the rear deck, and one sits on the roof while a second is mid-air in the foreground. The HUD shows "Leaper on the hull · swerve hard or handbrake". Two leapers clinging read clearly at low quality.
- **Throwers** (road high s011, `cap-wreckpile-high/s004`): barricade debris bursts at the bumper, with "Thrower ahead · dodge the debris or smash through".
- **Roadblock** (low s015, s019): the striped barricade line sits across the lane; after the APC ploughs through, crate debris flies and the run-over infected lie behind.
- **Rail-stall hatch fight** (stall low s006/s016, high s003/s007): bus rammed in behind, a crowd on both sides, a thrower Alpha with red eyes at 25 m, thrown debris landing at the hatch, "They're on the roof!", courier HP 80.

### Findings from real-key play (not fixed here)
1. **The l9-before-rail-stall fixture still carries the rocket launcher.** It predates main 7c723c82. Its tool weapon selection (Digit5) does not take while the courier is driving, so at the hatch she held the launcher ("too close") and died twice to 3–4 biting boarders (90 → 10 HP in 3 s), then retried from mid-crossing.

   The native bot, with MG and shotgun, holds the same stall at 100 HP. Re-pack the fixture on the current build (`tools/qa/make-checkpoint.ts`). Ask the PO whether 10 HP/s per boarder at an open hatch is the intended pressure: four boarders kill in about 3 s.
2. **The bridge-gate wall does not seal the bay.** It is `l9.bridge-gate`, halfZ 13 at x 472, and an APC circling the bay can drive round its open end (z ≈ 14–16) before the evacuation. It then sits between the gate and the bridge, and the evacuation cannot start because it needs the 11 m bay radius. The bot no longer does this, but a player can. Suggest extending the wall to the bay sides, or adding a jersey line at |z| 13–20.
3. **The fixture-play driver.** Its bang-bang steering and handbrake taps leave the road at the tanker and the poles, and it took 20–30 s stuck at the verge in two runs. That is the tool, not the game. The PO-style route points in the commands above keep it on the road.

## Browser QA needed (one QA lane)
- L9 road and countryside at high and low, zoom 1 and 1.5, WebGL2 and WebGPU:
  - all five jumps: airborne, landing, camera widen, landing shake;
  - boost strip bars, board and speed-up;
  - leaper crouch, pounce and cling;
  - throw arc, landing marker and debris;
  - roadblock barricades across the lane;
  - smash clusters;
  - tanker near miss: the blast lands behind the APC.
- Wreck-pile landing at zoom 1.5: the crushed cars must not clip the flying APC.
- Rail stall on a fresh save (no launcher): leaper on the hull at the open hatch, thrower debris at the hatch, rush at +14 s. Check courier HP pressure.
- Check that nothing pops in. Set pieces are admitted ≥ 105 m away; the proof's admission violations were 0.

## Commits
be46100e, 918e6e81, ebec1b56, (r28 tool) …, 0d7d37c1 (stall timing), e7f0d2f0, f5b07f70 (boost/smash/wrecks), 844c52bf (stall ambush), bay-approach bot, merges of main. See `git log main..HEAD`.
