# r41-vqa: real-play visual QA of PROD batch 80 (2026-11-11, Opus)

Build: main ce7f44f2 (+ QA tooling only), `npm run build:qa`, `vite preview` on 4931. One headless browser at a time through
`tools/e2e-lock.sh` (E2E_PORT 4931, SCENE_PORT 4932); every run <= 10 min. Real input = key presses and mouse via
`tools/qa/r28-vqa-fixture-play.ts` (same method as r38-vqa). New: `tools/qa/r41-vqa-probe.js` (`--setup`, read with
`--watch "return window.__r41"`): per frame the first non-finite `matrixWorld` under the courier view (the b77-b79 invisible
courier), hidden-courier frames, `hurt` frames and min HP; with `window.__fireOn=1` it also spawns up to 6 small fire patches in
front of the running courier from tick 300 (logged QA setup, so she takes real fire hits).

Captures (raw, not in git) and sheets: `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r41-vqa/`
(below `$S`). Every capture and sheet cited here was opened. Host load during the runs: 1-min load 4.5-6 typical, up to 11.9 during
the lion run (another lane's work); my own screenshots stall a frame by 50-300 ms.

## Sheets for the PO
| Area | Sheet (`$S/...`) |
|---|---|
| L9 APC pinned at the bay barrier (P1-1), bay horde | `sheet-l9-pinned-apc.jpg`, `sheet-l9-bay-horde.jpg` |
| L9 god run: gate, bay, bridge, collapse, crawl | `sheet-l9-bridge-collapse.jpg` |
| L10 courier hurt + Mega bursts, armored at the railing | `burst-l10-mega.jpg`, `burst-l10-armored.jpg`, `sheet-l10-mega-start.jpg` |
| L10 leaving the arena into the dark plain (P2-1) | `sheet-l10-void-east.jpg`, `sheet-l10-low-gpu.jpg` |
| L4 heavies on her, brute grab (courier drawn) / shop pocket (P2-5) | `burst-l4-heavy.jpg`, `sheet-l4-heavies-parked.jpg`, `crop-l4-pocket.jpg` |
| L8 flamingo, lion, monkey (fire hits), zebra, gorilla + elephant | `sheet-l8-flamingo.jpg`, `sheet-l8-lion.jpg`, `sheet-l8-monkey-fire.jpg`, `sheet-l8-zebra.jpg`, `sheet-l8-gorilla-elephant.jpg` |
| L8 monkey-yard exit stall (P2-3), elephant-yard pin (tool) | `sheet-l8-monkey-exit-stall.jpg`, `sheet-l8-elephant-pinned.jpg`, `burst-l8-yard.jpg` |

## Runs (matrix actually covered)
| Run (`$S/<dir>`) | Start | Quality | Zoom | Backend | God | Result |
|---|---|---|---|---|---|---|
| l10-mega-high-z15-gl | l10-dispersal-console, kiting driver | high | 1.5 | WebGL2 | off | 480 s: ~10 deaths, 1610 hurt frames, courier drawn, 0 errors; kited 200 m east into the dark plain (P2-1) |
| l10-mega-low-z1-gpu | l10-dispersal-console, kiting driver | low | 1 | WebGPU | off | 480 s: 1293 hurt frames, 0 errors; ran 340 m out, died at a railing (P2-1) |
| l10-megafight-high-z15-gpu | l10-dispersal-console, `--no-kite --prefer alpha` | high | 1.5 | WebGPU | off | 540 s: stand-and-fight, Mega 3000 -> 2090 HP, phase 2 by tick ~11000 and stuck at 2090 HP to the end, ~10 deaths, 3650 hurt frames, 0 errors |
| l8-start-low-z1-gl | L8 level start, marker | low | 1 | WebGL2 | on | 540 s: Nadia, rest, breach, seal, flamingo started at tick 7864 |
| l8-gorilla-high-z1-gpu | l8-before-gorilla, marker, `--prefer gorilla` | high | 1 | WebGPU | on | 420 s: gorilla dead in ~7 s (P2-3), elephant started at 4993, then pinned (tool) |
| l8-monkey-low-z15-gl | l8-before-monkey, marker, fire patches | low | 1.5 | WebGL2 | off | 300 s: monkey (fight at 1159, cleared 2285), zebra (8978 -> 10495), 6 fires taken |
| l8-lion-high-z15-gl | l8-before-lion, marker | high | 1.5 | WebGL2 | off | 300 s: lion (4256 -> 5415, courier down to 30 HP), monkey (6784 -> 7869) |
| l9-stall-high-z1-gpu | l9-before-rail-stall, marker driver | high | 1 | WebGPU | on | 480 s: hatch, gate, bay, 3/3 survivors, "Drive onto the bridge" 6645 -> collapse 6984, crawl, L10 start |
| l9-start-low-z15-gl | L9 level start, marker driver | low | 1.5 | WebGL2 | off | 540 s: to the bay; APC pinned at the bay barrier for 330 s (P1-1) |
| l4-linebreak-low-z1-gl | level:L4:line-break, marker, fire patches | low | 1 | WebGL2 | off | 420 s: heavies on her the whole retreat, ~8 deaths, 3388 hurt frames, 0 errors |
| l4-linebreak-high-z15-gpu | level:L4:line-break, marker | high | 1.5 | WebGPU | off | 420 s: two deaths early, then from tick ~14200 parked in a shop with brute + riot stuck 5 m away for 180 s (P2-5), 2312 hurt frames, 0 errors |
| l1-bat-low-z1-gpu, l1-bat2-low-z1-gpu | level:L1:bat | low | 1 | WebGPU | off | void: test-API load (title menu, then an empty unloaded world); L1 not covered |

Skipped: separate zebra / elephant fixture runs (zebra and elephant were reached from the monkey and gorilla runs), `level:L4:line-1`
(not restorable, see Tooling).

## Prioritised findings
### P1
1. **L9: the APC stays pinned at the evacuation-bay barrier for 330 s; the b80 break-free never fires and "Drive onto the bridge"
   cannot be finished by driving forward.** L9 level start, low WebGL2 zoom 1.5, god OFF, marker driver (W toward the marker,
   A/D steer, Space handbrake taps every 1.5 s while boarders ride, as the HUD says "swerve or handbrake (Space)"). The APC reached
   the bay at (443.1, 6.3) at tick ~12570 and never moved again until the run ended at tick 32261: evacuation, then "Drive onto
   the bridge" at 16117, then "Shake off boarders · swerve or handbrake (Space) while moving · 52 m" for the remaining ~270 s, APC
   "barely functional", 40-60 infected piled on its left side and rear (`$S/sheet-l9-pinned-apc.jpg`: s066-t16898 ... s097-t31944,
   identical pose and pile in every frame; `$S/sheet-l9-bay-horde.jpg`). b80 says a pinned APC breaks free after three stuck
   recoveries in 20 s. Hypothesis (not verified natively): the stuck recovery reverse in `Vehicles.ts:182` only runs with
   `!drive.brake`, so a player who follows the HUD and taps the handbrake suppresses the recovery and `breakFree` never sees three of
   them; or the pile keeps `physics.speed`/`stuck` from triggering at all. A player may get out with S (reverse); my driver never
   presses S. The god run from the rail-stall fixture drove onto the deck fine (brief item 2 below). Needs a native repro with handbrake taps.

### P2
1. **L10 console: the courier can leave the arena and run 200-340 m into an empty dark plain; the Mega and the armored follow.**
   Both kiting runs (no god): high WebGL2 to x 4199 ("Activate the dispersal console · 183 m", `$S/sheet-l10-void-east.jpg`), low
   WebGPU to z 300 ("· 342 m"), where she died against a lone railing with the Mega and armored on her
   (`$S/sheet-l10-low-gpu.jpg`, s012-t5732-b2, s013-t5863). Nothing stops or turns her; the ground is a flat dark plane with no
   props. In the high WebGL2 run two 3.7 s frames came out there (ticks 23115 and 23637, courier at x 4128-4168, terrain chunks
   resident 15 -> 10 between the two; host load 6.4; each right after a 50-60 ms capture). The low WebGPU and the stand-and-fight
   runs had max frames 217 ms and 50 ms. Re-measure the hitch in a quiet window; the missing boundary is a content gap either way.
2. **L8 gorilla is over in ~7 s and never touches her.** l8-before-gorilla, high WebGPU z1, god (HP never left 100, so god did not
   matter), MG: "Defeat Gorilla" at tick 755, phase 2 at 949, cleared (next leg) at 1347; the courier shot it from outside the
   enclosure fence while it stood in its ring (`$S/sheet-l8-gorilla-elephant.jpg`, s002-t1042). r38 had it parked; now it is a speed
   bump with the MG. Harmless boss (PO question: is MG + exposed window x1.8 meant to delete 500 HP this fast?).
3. **L8 monkey yard -> zebra leg: the marker points through the yard house.** 2 of 2 runs (low WebGL2 z1.5 no god; high WebGL2 z1.5
   no god): after the monkey pack the marker driver stood at (-18.x, 19.3), "Cross the visitor field to the zebra paddock · 14 m",
   for 70 s and 167 s (to the end of the run). The first node of the zebra leg is the yard exit (-24, 32); from where the fight
   ends the straight line runs into the house/fence (`$S/sheet-l8-monkey-exit-stall.jpg`, courier packed in her group at the north
   fence). A human walks around, but the marker gives no hint; one extra node (around the house) would fix it. Driver limitation
   partly (it goes straight).
4. **L9 bay without god: all survivors die and the level moves on with 0 saved.** Same run as P1-1: "Cover the survivors · 0/4 ->
   0/3 -> 0/2 -> 0/1 -> 0/0" (ticks 12553-13481), again 0/4 -> 0/0 (14316-14844), then "Drive onto the bridge". My driver does not
   shoot from the hatch, so this is "what if the player cannot cover them". Is fail-forward with 0 rescued intended? (r38 god run:
   3/3.)

5. **L4: wide-body heavies park behind a shop shelf 5 m from her for 3 minutes.** level:L4:line-break, high WebGPU z1.5, god off:
   from tick ~14200 to the end (24840) the courier stood at (5.9, 36.4) inside the cut-away shop north of the plaza with a brute
   (214/450 HP) at 4.8-5.3 m and a riot at 5.1 m in state `chase` the whole time, neither moving nor attacking; HP stayed 100
   (`$S/sheet-l4-heavies-parked.jpg`, s046-s068 identical; `$S/crop-l4-pocket.jpg`: courier and corgi in the aisle, the heavies
   behind the shelf row inside the same shop). The r40 wide-body nav does not find the way around the shelf (or the aisle is
   narrower than their radius). A safe pocket in the retreat; the threat audit should flag it. My driver stood still there (it
   only kites from enemies within 6 m), so a human would leave sooner, but the heavies are stuck either way.

### P3
1. L8 flamingo: the marker-follower got pinned at the brick building beside the gate (-7.2, -11.3), outside the zone, for 4.5 min
   in phase 2 while three more flights came in (cap 4, `L8BossArenas.ts:190`); the birds pile up over her group
   (`$S/sheet-l8-flamingo.jpg` s030; raw `l8-start-low-z1-gl/s053-t25485.jpg`). Mostly my driver (point-blank aim), but a crowd of
   20+ birds hovering in a stack reads as clutter.
2. L8 Nadia reads as a near-black figure in the lit marker ring at night next to normally lit group members
   (`l8-start-low-z1-gl/s001-t484.jpg`, `s003-t1454.jpg`).
3. L10: the courier is drawn with the gold occlusion outline right next to the console tank although nothing covers her
   (`$S/burst-l10-mega.jpg`); same in r38. Cosmetic.
4. L10 low WebGPU: the corgi ended on the other side of the lone railing from the courier (`l10-mega-low-z1-gpu/s012-t5732-b2.jpg`).
5. L9: the courier view is hidden for every frame she is inside the APC (probe `hidden` 26776 frames); expected, noted so nobody
   reads the probe as a regression.

## Per brief item
### 1. Courier hurt regression (hotfix 9f4d2648)
**PASS where covered.** Probe `tools/qa/r41-vqa-probe.js` on every run: first non-finite courier node = none, page errors = 0, hidden
courier on foot = 0 frames, in all 11 valid runs. Real hits taken (hurt-animation frames): L10 1610 / 1293 / 3650 (Mega slams and
charges, armored, deaths and respawns, high WebGL2 z1.5, low WebGPU z1, high WebGPU z1.5, all god off); L4 3388 / 2312 (butcher, brute,
riot, armored, Alpha; low WebGL2 z1 with 6 fire patches / high WebGPU z1.5, god off); L8 lion 178 (lion pounces to 30 HP, high WebGL2 z1.5), monkey run
90 (6 fire patches + monkeys, low WebGL2 z1.5); L9 392. She is drawn in every burst frame I opened, including knock-down/hurt poses
(`$S/burst-l4-heavy.jpg` s019 row: brute grab, courier on the ground, still drawn) and at 0 HP (`sheet-l10-low-gpu.jpg` s013).
Full L10 Mega fight without god: not achievable with my driver; the stand-and-fight run reached phase 2 (3000 -> 2090 HP) and died
~10 times, every respawn drawn. **Not covered:** L1 (test-API load void, see Tooling); the corgi and Sam/allies being hit (no probe;
the corgi was drawn in every frame I opened, including L10 deaths).

### 2. L9 (b80)
- Marker -> bay -> deck with god from l9-before-rail-stall (high WebGPU z1): **PASS.** "Drive onto the bridge" 6645, collapse 6984
  (~6 s), crawl "Everything went into the river. Almost everything.", L10 start (`$S/sheet-l9-bridge-collapse.jpg`).
- Without god from level start (low WebGL2 z1.5): **FAIL, P1-1** (pinned at the bay barrier, no break-free in 330 s).
- Break-free jump look: not seen (it never fired). Overpass ramp landing: no ramp taken in either run (APC y <= 1.02 in every driving event log line), not verified.

### 3. L8 (b80)
- Following the marker starts the fight: **PASS** for flamingo (start, tick 7864), lion (4256), monkey (1159 and 6784), zebra (8978),
  gorilla (755), elephant (4993). The r38 "ring outside the gate" stall is gone.
- Gorilla with the group between: gorilla died in ~7 s before anything could be judged (P2-2). Distance readout: follows the animal
  (gorilla "6 m" with the gorilla ~6 m away; lion 17 -> 6 -> 3-5 m while it closed, `$S/sheet-l8-lion.jpg`). **PASS.**
- Escape through gates: no leak seen; the monkey exit leg instead stalls behind the house (P2-3).

### 4. L4 (b80)
- line-break retreat, no god, low WebGL2 z1: **heavies path and reach her all the time.** Riot/armored at 2-4 m at tick 613,
  butchers at 1.3-1.9 m at 2259, brute/Alpha/riot packs at 1-3 m through the whole run, ~8 deaths in 420 s, no stuck heavy in the
  logs (every logged heavy within 7.5 m was in chase/attack, apart from one idle riot and one wandering armored right after her
  deaths). `$S/burst-l4-heavy.jpg`: two butchers on her on a raised planter, a
  brute grab with riot and armored behind. Hold step (line-1): not reachable through the test API (Tooling). Cellar prompt: not
  reached (she died before the cellar every time).
- line-break, high WebGPU z1.5, god off: same pressure for 4 min, then P2-5 (heavies stuck behind a shop shelf for 3 min).
  So: no stuck heavies on the streets, but one stuck pocket indoors.

### 5. Zombies (clip fix)
Attack and hit poses look like r38 (`$S/burst-l10-armored.jpg`, `burst-l4-heavy.jpg`, `burst-l10-mega.jpg` vs
`.../r38-vqa/burst-l10-s002.jpg`, `burst-l4-s003.jpg`): armored step in with arms forward, butchers wind up, the Mega's slam ring and
lunge read, no figure vanishes or flickers in a burst, no foot sliding seen in the frames. One oddity: the armored pack attacked
her across a railing at 1.2 m (`burst-l10-armored.jpg` s021 row) and she kept losing HP there; the railing is low, so it may be fine.

## "Is it stunning?" / "boring, harmless, babysitting?"
- L10: the console set piece (tank, Mega with telegraph ring, armored waves, explosions) reads well and is dangerous now (without
  god she dies every ~15 s standing still). But the arena has no edge (P2-1): kiting leads into a black, empty plain.
- L9: the bay horde and the collapse cinematic are the most spectacular moments of this batch; the bay without god turns into an
  unwinnable pile on the APC (P1-1, P2-4).
- L8: the marker now walks you into every fight, and the zoo at night with flamingo flights, lion pounces and zebra stampedes is
  busy. Harmless: the gorilla (P2-2). Babysitting: the monkey-yard exit (P2-3).
- L4: the retreat is a real gauntlet now (until you find the shop pocket, P2-5): heavies everywhere, you cannot stand still. Not boring, possibly too hard without god for
  a kiting player (8 deaths in 7 min with an MG), PO to judge.

## Tooling (QA only, committed)
- `tools/qa/r41-vqa-probe.js`: courier-drawn probe + optional fire patches (see top).
- Note for later lanes: `level:L1:<cp>` via the test API leaves the title menu open (the L1 run `l1-bat-low-z1-gpu` played behind the
  menu and is void); pass `--setup "g.ui.show(null); ..."`. `level:L4:line-1` throws `Unknown checkpoint` (only checkpoints the
  mission captured on load can be restored; `line-break` works).
