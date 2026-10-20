# Playtest-all: the campaign played by real input (10-20)

Lane `lane/playtest-all`. The lane started on `lane/p0-l5-finish` (90e0ba7e5) with `lane/l6-tunnel` (247c4e2c4) merged in. L8–L10 and the L5–L7 continue pass ran after `main` 82604a125 was merged as well (e1095f6ab). So L1–L7 of the campaign ran on the pre-hotfix lane build and the rest on main plus l6-tunnel. Every run used a fresh `npm run build` preview, headless, under `tools/e2e-lock.sh` with one browser, port 3821.

Short verdict: **with the driver bugs taken out, no level was proven impossible to finish.**
- **Real play, no skip:** L3, L4, L5, L8 and L9 were finished by real input.
- **One step skipped:** L1, L2 and L7 each needed one step skipped. For L1 and L2 the cause was mostly the driver's own pathing; for L7 it was a driver bug (a stale ring), now fixed.
- **L6:** finished only with two skips. Its "deadlock" was also the stale-ring driver bug, retracted.
- **L10:** reached the final console in about 20 min, with skips forced by the driver's 12-min level cap.

The real findings are below. They are mostly P1/P2: rings and hidden waits, a click-to-move trap, unreachable-looking search spots, long frames at the L8 start and in L5/L6, and infected that seem to take no damage at point-blank range.

## The driver: `tools/playtest/`

`npm run build && npm run playtest -- --levels L1-L10 --quality low` plays a range of levels.
- `--mode campaign` (default): one browser session from a new game through every real handover.
- `--mode continue`: one browser session per level. Each resumes the save through the menu (Start game → resume level) and stops after the handover, so the browser lock is released between levels.
- Other options: `--heroine female|male`, `--zoom 1.5` (wheel-out to 1.5, applied at each level start), `--level-minutes N` (cap per level; after it the active step is skipped with the debug cheat and logged as P0 "cannot-finish"), `--entry new|continue|debug`, `--keep-profile`, `--out dir`.
- Output: `summary.json`, `log-*.jsonl` (progress, assists, hitches, prompts), `issues-*.json`, and `captures/*.jpg` (a frame every 45 s plus one per issue).
- `tools/playtest/probe-l7.ts` is a small handover probe for the L7 start position via the handover, menu Continue and the debug select.

**Input.** Only real device events:
- mouse clicks on the ground (the game's own click-to-move);
- WASD (walking around blockers, vehicles);
- mouse aim plus Space to attack;
- E for prompts and rings;
- real clicks on the menu, Begin, Continue and Retry buttons;
- the mouse wheel for zoom.

No teleports and no injected frames.

**What it reads.** What a player sees:
- the HUD objective text and distance, and the on-screen diamond or edge arrow;
- the 3D ring (the active marker's anchor, the same point the ring is drawn at);
- the minimap cue pins (the L5 "Search ..." pin, step pins);
- interaction prompts and the mission panel;
- health, plus bodies that are on screen (`input.visible`).

**Ground truth, always logged.** These reads go into `log-*.jsonl` as `assist`:
- `nav-follow`: for a ring more than 25 m away it walks the nav-grid route with WASD. This stands in for the player's map sense; within 25 m it clicks the ring.
- `nav-locate`: clicks made no progress for 10–30 s, so it follows the nav route for 20 s, or for the rest of the step after a second episode.
- `state-locate`: after 120 s without objective progress it dumps the mission states and counters into the log and an issue.
- `skip-step`: the step cap (420 s on one step) or the level cap was reached.

**Detectors.**
- 20 s without objective progress, at the ring or while navigating;
- an ally standing still while an infected hits it;
- a corpse with full health;
- an ally walking backwards for 3 s;
- an infected in chase that does not move for 5 s;
- a target that takes no damage from 8 s of attacks;
- rack weapons lost across a handover;
- console and page errors;
- frames over 200 ms during play (logged; issues above 500 ms).

**Known driver limits.**
- Its fighting is crude: it stands and fires, and dies often (12 deaths in L1, 20 in L6), so death counts are not a difficulty measure.
- The "stuck" detectors fire on long legitimate steps (L3's 364 m route, L10), and the HUD distance can point at a moving guidance waypoint. Not every `stuck-navigating` entry is a game problem; the list below is curated by looking at the captures.
- It skips steps with `cheats.completeObjective`, which can leave scripted state half-done (L10 "hold" came back after "Watch the cure spread"). Nothing after a skip in the same level counts as evidence.
- Two driver bugs produced false P0s during the run and were reported, then retracted to the orchestrator. Both are fixed in f260a4831: the cached ring read (0,0,0) on L7's first frame, and the L6 l6-next waypoint moved on while the cached copy stayed at the x=150 gate.

## Runs

The heroine was female for L1–L10 (low quality, zoom 1.5, via the real handovers) and male for the continue pass (see the end). Times are wall time at real speed.

| Level | Finished | Time | Skipped steps | Notes |
|---|---|---|---|---|
| L1 | yes | 12.5 min | weapon (after 7 min) | Driver mobbed while unarmed and lost behind fences; fire-bay ring took 4 min |
| L2 | yes | 9 min | bridge (after 7 min) | Pinned at the crashed police car, Maple Ave/Pine St, in 2 sessions |
| L3 | yes | 9 min | – | 364 m route with the moving guidance waypoint |
| L4 | yes | 4.6 min | – | Clean, no issues |
| L5 | yes | 9.5 min | – | All survivors found; the Metro step took 4.5 min at the entrance |
| L6 | yes | 11 min | retreat, exit | The retreat skip was the driver bug; exit was skipped at the level cap with the courier at the ring |
| L7 | yes | 7.5 min | rocket (driver bug) | The bus departed about 20 s after the courier reached it, with no group |
| L8 | yes | 2 min | – | APC boarded and driven out; the group was empty (see L7) |
| L9 | yes | 2 min | – | Real driving, crash and crawl worked |
| L10 | reached the console | ~20 min | research, dispersal-complex, hold ×2 | Level cap 12 min; the "research" ring sits on the wall edge (below) |

Handovers L1→L2, L2→L3, L3→L4, L4→L5 (directly, no result screen), L5→L6 (progression), L6→L7 (result, Continue), L7→L8, L8→L9 and L9→L10 all happened through the game. After the driver restarts the session resumed through the menu: Start game → resume level, which means "continue" worked at L2, L3, L5, L8 and L9.

**Weapons across handovers.** Nothing that was in the rack got lost. The racks were:
- L2: bat, kick, kick
- L3: + fire-axe, molotov, corgi-lure
- L4: + handgun
- L5–L9: + army-mg; molotov in owned
- L10: fire-axe ×2 (L10 strips weapons by design; you recover them at checkpoints)

The PO's "lost the shotgun" could not be checked: the driver never picked up a shotgun in L5, so none was owned. Note that the rack shows `weapon.kick` twice in L2 and `weapon.fire-axe` twice in L10, which may look odd in the HUD (P3).

**Console errors.** None in any run.

**Hitches** (frames over 500 ms during play):

| Level | Tick | Position | Frame | Notes |
|---|---|---|---|---|
| L8 | 60 | (0,70) | 3350 ms | Twice, in two sessions; P1 |
| L5 | 7232 | (-45.4,40.1) | 4216 ms | At the wrecked bus on Lakeshore; P1 |
| L6 | 52695 | (253,15) | 2750 ms | Near the exit platform; P1 |
| L10 | 0 | – | 2717 ms and 1617 ms | First frames, load tail; P2 |
| L8 | 3787 | – | 1083 ms | P2 |
| L7 | 0 | – | 550 ms | P2 |
| L10 | 2931 | – | 550 ms | P2 |

Screenshots taken by the driver may add a little to individual frames, but not seconds.

## Issues per level

Severity: P0 means the level can't be finished; P1 a stuck or confused player, a ring off its trigger or a hidden wait; P2 means confusing or minor; P3 cosmetic. Captures are in `captures/`. I looked at each one.

### L1 · Special Delivery

1. **P2, click-to-move trap behind the Maple Ave houses.**
   - Where: tick ~32350 (and ~7480 in a second session), position (40–45, 15.8).
   - What: on "Find something to defend yourself" and "Get inside the fire station" the edge arrow points straight through the houses. Clicking toward it (the game's own routing) walks the courier into the fenced side alley between two yards. It stays there until the player walks around by keys. A human following the arrow with the mouse will hit the same spot.
   - Suspected cause: click-to-move routes to the clicked point through the yard gap and stops at the fence; the arrow gives straight-line direction only.
   - Capture: `captures/campaign-L1-32357-stuck-navigating.jpg`
2. **P2, unarmed mob before the bat.**
   - Where: tick ~9230, position (51.5, 5.2).
   - What: with fists only, the accident street crowd surrounds the courier (10/100 HP). The driver died 12 times in L1, mostly here.
   - Unclear whether a human is as exposed; worth a human check of the "find a weapon" leg.
   - Capture: `captures/campaign-L1-9231-stuck-navigating.jpg`
3. **P1, fire-bay ring blocked by bodies.**
   - Where: tick ~38800, position (-74.2, 40.6).
   - What: the courier stood 2.5 m from the r 0.5 ring for about 4 min. Three corpses and a standing infected (speech bubble "Get in!") lie on the ring. A click on the ring picks the bodies (attack) instead of moving in, and the trigger (r 0.5) is smaller than the drawn ring (r 0.6).
   - Capture: `captures/campaign-L1-38808-stuck-at-ring.jpg`

### L2 · Engine 3

4. **P1, pinned against the crashed police car.**
   - Where: tick 15600–33430, position (50.2, 1.7), on "Reach the police checkpoint at the bridge · 41 m" (2 sessions, 7 min each).
   - What: the courier presses into the police car parked across the Maple Ave / Pine St crossing.
   - Suspected cause: the nav-grid route north (headless check: (50.2,1.7) → (49.3,8.8) → …) runs through the car, which is not an obstacle in the grid. Click-to-move takes the same route.
   - Capture: `captures/campaign-L2-33434-cannot-finish.jpg`
5. **P2, backyard dead end.**
   - Where: tick ~17670, position (63.5, 9.6).
   - What: following the bridge arrow with clicks leads into a fenced backyard (26 m from the ring).
   - Capture: `captures/campaign-L2-17667-stuck-navigating.jpg`

### L3 · Collapse

6. **P2, HUD distance does not match the ring.**
   - What: the tracker distance and the diamond follow the moving `l3-route` waypoint ("· 5 m" … "· 15 m") while the ring is at `l3-zone` (225, 0), 350 m away. The arrow and the number keep saying "close" for the whole route.
   - Also noted in the static audit (item 15 below).
7. **P3, guards finish in 8 s.** The station defence ("Help defend the station") ended after 8 s (fallback), so the step is barely seen.
8. **P2, infected out of reach at range.** Some infected in chase stood still 9 m away (`enemy-frozen`, ticks 5091 and 8107), probably behind the station gate. Not a bug by itself.

The level finished by real play: ring at 222.2, 0, then the 15 s evacuation.

### L4 · Fairhaven

No findings. Ride, quartermaster, hold, cellar route, bar and stay down all completed in 4.6 min by real input.

### L5 · Aftermath

9. **P2, hidden survivor spots give no visual cue.**
   - Where: tick 5431, position (-34.2, -5.7).
   - What: the HUD says "Search the church vestry · 4 m" next to the church door, but nothing at the spot marks it, and the spot (-33.5, -2.7) lies behind the church wall. The courier needed 66 s and an E press. Meanwhile the bright cyan medkit ring a few metres away is the most visible ring on screen, which is the PO's "medkit rings" confusion.
   - Capture: `captures/campaign-L5-5431-stuck-at-ring.jpg`
10. **P1, Metro entrance hard to enter.**
    - Where: tick 14000–21460, position (36–39, -45).
    - What: on "Lead the survivors down into the Metro · 4 m · Survivors in 0/1" the ring stands on the top stair behind the brick gate pillar. The courier spent about 4.5 min within 3.5 m before getting onto the stairs and finishing. Only one survivor (Rosa) was still alive at that point.
    - Once in, the shutter, gate and finish worked; I did not see "the figure walks back out".
    - Capture: `captures/campaign-L5-21456-stuck-at-ring.jpg`
11. **P2, infected take no damage at point-blank.**
    - Where: ticks 19367–23500.
    - What: infected #104 (hp 60/60) and #102 at 1.1–2 m in "attack/chase" took no damage from army-mg or handgun fire for several minutes. #88 (300 hp, likely an Alpha) at 3.6 m took none either. The capture shows the tracer passing the pale infected right in front of the courier.
    - The same pattern showed in L6 (5 infected at 1.1–2.1 m) and L3. It could be the driver's aim (cursor on the body at 1 m), but it matches the PO's "Alpha that ignores being shot". A human check is recommended.
    - Capture: `captures/campaign-L5-19367-enemy-unhittable.jpg`
12. **P1, hitch.** A 4216 ms frame at tick 7232, position (-45.4, 40.1), right after the wrecked-bus survivor was found.

### L6 · The Subway

13. ~~P0 gate deadlock at x=150~~ was a driver artifact (stale ring), retracted.
14. **P2, gate panel stays up after the guidance moves on.** Standing near a service gate always shows "Block the tunnel · Let everyone pass · E to close the gate", even after the guidance has moved past it.
15. **P1, hitch.** A 2750 ms frame at tick 52695, position (253, 15), near the exit platform.
16. **Untested.** The "exit" step ("Bring the survivors into the night · 0 m") was skipped by the level cap 10 s after the courier reached the ring, so I couldn't test whether the group exit works. The continue pass re-plays it.

### L7 · Northgate

17. ~~P0 origin spawn~~ was a driver artifact, retracted. The courier starts at (273, 15), y 4.6. That was confirmed in 6 probes (main and lane × handover, Continue, debug select), all ticking. Probe captures were in my scratchpad.
18. **P2, the group is not required.**
    - What: after the rocket the courier walked alone to the corridor and the bus. The corridor step completed and the bus departed about 20 s after arrival with nobody aboard, because no roster member was `following`.
    - Effects: "Bring the group to the evacuation corridor" does not require the group, and "Get everyone aboard the bus" gives no count. L8 then had no survivors.
19. **Not seen here.** The L7 start hang did not occur; the sim ticked from tick 0.

### L8 · Zoo

20. **P2, stale HUD after boarding.**
    - Where: tick 6291, position (84.6, -79.8).
    - What: while the courier was already driving the APC, the HUD still read "Bring the survivors to the armored vehicle and board · 156 m". The ring and distance point at the APC's spawn door position (`LevelEightZoo.ts:101`, audit item 17).
    - Capture: `captures/campaign-L8-6291-stuck-navigating.jpg`
21. **P1, hitch.** A 3350 ms frame at tick 60, reproduced in two sessions.

### L9 · Crash

No findings. Real driving: "Drive toward the city" to (470, 0), then the crash and the crawl in 2 min. The road is barely visible at night at low quality; the driver drove cross-country.

### L10 · Cure

22. **P1, research terminal ring on the wall edge.**
    - Where: tick 33765, position (2706.7, 38.4).
    - What: the ring for "Play the research recording · 3 m" is drawn half inside the lab wall, behind the console. The courier stood 2.6–3 m away on the console's far side for 85 s, mobbed by a horde (19/100 HP), and never reached it.
    - Capture: `captures/campaign-L10-33765-stuck-at-ring.jpg`
23. **P2, finale state flapped after cheat skips (unconfirmed).** After the "hold" step was skipped twice by the cap, the HUD went "Watch the cure spread" → "Activate the dispersal console" → "Release the cure at the console". This came after cheat skips, so it is evidence of nothing; listed only so nobody chases it.

## Static audit: does every ring sit in its real trigger?

Code audit of all steps L1–L10 (mission defs, per-level scripts, `ObjectiveMarker`, `MissionUI`), done by a sub-agent on this branch with headless checks. **No level has a marker point outside its real completion volume.** These are the mismatches.

How the ring and HUD are drawn:
- The ring is a fixed 0.6 m torus at `anchor.y + 0.08` (`src/render/ObjectiveMarker.ts:11`). Its size never follows the trigger radius.
- The cone arrow is at `anchor.y + 2` with `depthTest` off.
- The on-screen diamond and off-screen arrow use a fixed world y = 1.8 (`src/ui/MissionUI.ts:111`), so they float at head height and ignore `anchor.y`.
- The tracker text is rewritten only while a step is active (`MissionUI.ts:81, 136`).

**P1, the ring is not the whole trigger, or the wait is hidden:**
1. **L7 "Get everyone aboard the bus".**
   - Boarding starts within 6 m of the boarding point, while the ring is 0.6 m.
   - Departure needs every `following` roster member aboard (14 m claim radius, `LevelSevenDeparture.ts:115-133`).
   - The HUD shows no count and no reason. A straggler holds the bus with no feedback; that fits the PO's "Checkpoint not working".
   - "Ring at head height": the ring itself is at y 0.08, but the diamond (y 1.8) and the cone (+2 m) float at head height.
2. **L5 Metro.**
   - The HUD names "Survivors in n/m" and "shutter closing".
   - It does not name the 3 s dwell, the corgi requirement, or that leaving the 2 m × 4.35 m box behind the shutter resets the timer (`LevelFiveAftermath.ts:321-404`). The ring's north rim is only 0.05 m inside that box.
   - If the corgi can't be placed, `shutter()` silently returns every tick while the HUD says "Everyone is in" (`:339`). That is a candidate for the PO's "no idea what finally triggered the finish".
3. **L7 corridor.** "Bring the group to the evacuation corridor" completes with the player alone (east r 6 or west r 12, `L7/mission.ts:19`). The run confirmed it (issue 18).
4. **L6 timers.**
   - "Look around the shelter" is a 30–40 s timer.
   - "Stop the infected" is breach + 15 s, or 3 survivors turned; kills don't count (`LevelSixSubway.ts:216`).
   - "Bring the survivors into the night" needs every living survivor past x 263, with no count shown.
5. **L4 timers.** "Hold the plaza with the army" hides a fixed 200 s timer; "Stay down" hides 7 s.
6. **L2 bridge.** Crossing counts only after the radio line; the step then completes about 2.6 s later, after the corgi is moved inside (`LevelTwoRescue.ts:681-694`).
7. **L3 checkpoint.**
   - The trigger is a 0.9 m disk.
   - After reaching it, the boom closes only when every following officer and the corgi are past x 214.2 and no bystander is under the arm.
   - The HUD names this only partly ("Waiting for the rescued group").
8. **L8 escape.** It needs the player as driver plus every rostered survivor and the corgi seated, with no count shown. The ring is a snapshot of the APC door at spawn (issue 20).

**P2:**

9. **Diamond and arrow ignore anchor height.** They sit at y 1.8, not floor + 1.8. The worst cases are the raised anchors:
   - L6 night-exit and L7 rocket (y 3.9)
   - L5 metro-in (0.94)
   - L1 fire bay (0.53)
   - L2 axe (0.4)
10. **Stale tracker in gaps:**
    - L2 `calm` keeps "Take the fire axe" with no marker.
    - L3 between armory and defend.
    - L5 shows "Unbar the cellar door · distance" for about 10 s after emerging.
11. **Rings 0.1–0.25 m under raised paving**, where the anchor has no y:
    - L1 garage-door and garage-bat (0.24 and 0.25)
    - L4 cellar-door (0.13)
    - L7 corridor-east (0.13)
    - L8 exit (0.12)
12. **L1 fire-bay trigger smaller than the ring.** The trigger is r 0.5, the drawn ring r 0.6.
13. **Instant or duplicate steps:**
    - L1 `escape` and L2 `calm` last about one tick.
    - L10 `crash` completes on tick 1, because the player starts on its anchor.
14. **Minimap pin and ring disagree.** Pins use the step anchor; the ring uses `state.marker`:
    - L6 retreat: pin at exit-platform, ring at l6-next.
    - L1 weapon: pin at the bat, ring at the garage door, 1.6 m apart.
    - L3: the diamond and distance follow l3-route.
15. **L9 approach tests the car.** It checks the car's x, not the player's; on foot nothing triggers.
16. **L1 rings visible through roofs.** Rings with depthTest off show through roofs as rings on the roof. Seen in L1 during the trial run; no capture was kept.

## What is left

- **Not played:** the high-quality pass, and a full male campaign. The male continue pass covered L5–L7 only (see below).
- **Driver:** the fight logic needs to kite and retreat so death counts become meaningful. Long-route "stuck" detection should use real progress (distance to the ring), not step changes.
- **Human checks recommended:**
  - the point-blank no-damage pattern (L5, L6, L3);
  - the L2 police-car route;
  - the L10 terminal ring;
  - the L8 start hitch.
