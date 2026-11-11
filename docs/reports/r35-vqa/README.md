# r35-vqa: visual QA by real input before the PO's morning play (2026-11-11, Opus)

Build: main 93016109 (PROD batch 75), `npm run build:qa`, `vite preview` on 4931. One headless GPU browser at a time through
`tools/e2e-lock.sh`; every run under 10 min. Real input = key presses and mouse via `tools/qa/r28-vqa-fixture-play.ts`
(level start `level:<L>` or a QA fixture in `tests/fixtures/saves/qa`). Heavy zombies also in Scene Lab (`SCENE_SERVER=preview`,
port 4932) from the `specs/scenes/r33-heavies/lineup-*` specs re-cut for zoom 1/1.5 and idle/chase.

Captures (raw, not in git) and the PO sheets: `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r35-vqa/`
(below `$S`). Every capture cited here was opened.

## Sheets for the PO (one per area)
| Area | Sheet |
|---|---|
| L8 linear route: start, plaza, breach, seal, flamingo, lion gate, gorilla gate escape | `$S/sheet-l8-route.jpg` |
| L8 animals at night (lion, lioness, flamingo, gorilla, elephant) | `$S/sheet-l8-animals.jpg` |
| Heavy zombies, Scene Lab, L4 dusk and night, both backends, zoom 1/1.5 | `$S/sheet-heavies-scene.jpg` |
| L4 heavies in real play + L5 first rescue / church marker | `$S/sheet-l4-l5.jpg` |
| L9: Space handbrake, ramps, hatch, bay, bridge approach, crawl | `$S/sheet-l9.jpg` |

## Runs (matrix actually covered)
| Run (`$S/<dir>`) | Start | Quality | Zoom | Backend | Notes |
|---|---|---|---|---|---|
| l8-start-high-z15-gpu | L8 level start, no god | high | 1.5 | WebGPU | 480 s: Nadia, plaza, breach, seal, flamingo (bat only: the weapon key landed under the briefing panel, tool fixed after) |
| l8-lion4-low-z1-gl | l8-before-lion, god, route along the lion leg | low | 1 | WebGL2 | 480 s: service path, lion + lioness fight (not finished) |
| l8-gorilla-high-z1-gl | l8-before-gorilla, god, route | high | 1 | WebGL2 | 470 s: gorilla fight, gate escape, east lane |
| l8-elephant-high-z15-gl | l8-elephant-apc-yard-engaged, god | high | 1.5 | WebGL2 | 150 s |
| l4-low-z15-gpu | L4 level start, god | low | 1.5 | WebGPU | 360 s: arrival to line-break |
| heavies-gpu-low / heavies-gl-high | Scene Lab lineups (L4 dusk + night, idle + chase) | low / high | 1 and 1.5 | WebGPU / WebGL2 | 8 scenes |
| l9-start-low-z15-gl | L9 level start, no god, route over both road ramps, Space handbrake | low | 1.5 | WebGL2 | complete level in 300 s (start to upgrade screen) |
| l9-stall-high-z1-gpu | l9-before-rail-stall, K handbrake, route to the bay's NE corner | high | 1 | WebGPU | stall, bay, bridge, crawl, into L10 |
| l9-crawl-low-z1-gpu | l9-at-bridge | low | 1 | WebGPU | crash + crawl |
| l5-high-z15-gpu, l5c-low-z1-gl | L5 level start, handgun, no god | high / low | 1.5 / 1 | WebGPU / WebGL2 | marker-only run (stood 5 min), route run to Mia then marker |

Earlier lion runs (`l8-lion-low-z1-gl`, `l8-lion2`, `l8-lion3`) were stopped: the straight-line driver pinned itself on a
planter / the perimeter wall (tool, not game). Not covered: monkey and zebra arenas (no fixtures, the lion run did not finish),
zebra/monkey night colours, L8 checkpoints after the flamingo, the L9 crawl "stop in the ring" case by real input (the tool's idle
regex never matched; the crawl completed with input in both full runs), L5 beyond Mia.

## Prioritised findings

### P1
1. **L8 gorilla arena: the courier ends up outside the closed exit gate in mid-fight.** l8-before-gorilla, high WebGL2 zoom 1, god:
   fight starts at tick 755 (objective "Defeat Gorilla ... Phase 1"); the courier stands against the closed exit gate at (81.4, -29.x)
   with the gorilla 2.1 m away (tick 3945, gorilla 473/500); 3 s later she is at (86.1, -28.5) on the east lane, gorilla alive,
   objective "Defeat Gorilla ... 34 m", the group left inside (`$S/l8-gorilla-high-z1-gl/s015-t3769.jpg` courier drawn inside the gate
   panel, `s016-t4000.jpg`, `s017-t4247.jpg`). She then walked the whole service lane to the elephant paddock with the fight still
   open. The exit is a 0.5 m thick sim barrier (`l8Route` gorilla exit, halfX .25); the jump of ~4.7 m with the gorilla in contact
   points at a gorilla shove/knockback carrying the courier through the thin barrier (not proven: no tick-level trace). Repro:
   fixture + the route in the run table (`--route=60,12;60,0;60,-8;60,-30;82,-32;96,-32;96,40;96,56 --block 120`).

### P2
1. **L8 gates are drawn through the courier.** At the lion exit (tick ~3500, (-59.3, -12.6), low WebGL2 z1) and the gorilla exit
   (tick 3769, high WebGL2 z1) the wooden keeper-fence panel crosses the courier's body: the drawn gate stands ~0.3-0.5 m inside the
   sim barrier (`$S/l8-lion4-low-z1-gl/s014-t3512.jpg`, `$S/l8-gorilla-high-z1-gl/s015-t3769.jpg`).
2. **Lion and lioness still do not read as big cats at game zoom.** Colour is fixed (tan/orange, also at the Nadia stop, high WebGPU
   z1.5, `s012-t3691.jpg`), but the infected lion is a round spiky mane ball with a tail and the lioness a striped bell shape
   (low WebGL2 z1, `$S/l8-lion4-low-z1-gl/s014-t3512.jpg`, `s086-t21225.jpg`, crops in `$S/sheet-l8-animals.jpg` 3-4).
3. **L9 bay to bridge: ~130 s to get the APC onto the bridge.** l9-before-rail-stall, high WebGPU z1: after "Cover the survivors 4/4"
   at tick 7473 the objective "Drive onto the bridge · 13-15 m" stays for 130 s while the floored APC ("barely functional") rams a
   horde of 20+ infected incl. 3-4 armored and a brute between the bay and the bridge (`$S/l9-stall-high-z1-gpu/s040-t8678.jpg`,
   `s055-t12388.jpg`). The marker driver steers straight at the pin; a human may do better, but the bridge lane is the most crowded
   spot of the level at the moment the APC has no armour left.
4. **L9 crawl: four infected stand around the downed courier for 2 min doing nothing.** l9-at-bridge, low WebGPU z1, no god: brute,
   screamer, runner and dog at 1.1-1.3 m of the crawling courier from tick 728 to the end (tick 7775), courier HP 100 throughout, no
   hit either way (`$S/l9-crawl-low-z1-gpu/s018-t4435.jpg`). Harmless crowd during a scripted scene. (The tool backed away, so the crawl
   itself did not progress in this run; in both full runs the crawl ended in the ring with the upgrade screen.)
5. **L9 armour is at the floor long before the bay, again.** Level start, low WebGL2 z1.5: 1000 at 0 s, 450 at 53 s, CRITICAL at 61 s,
   "barely functional" from 82 s to the end (`$S/l9-start-low-z15-gl/s010-t3195.jpg`). Caveat: most of it came while my route
   steered the APC off-road into a horde with a brute at (-430, -125) for ~25 s; the stall fixture also arrives at the bay floored.
   "Bay arrival with armour left": not seen in either run.
6. **L9 overpass jump lands nose-first in the landing block.** Low WebGL2 z1.5, tick 7499-7573: the floored APC (~9-10 m/s) leaves the
   overpass slab, drops its nose into the broken landing block and sits at 0.1 m/s (`$S/l9-start-low-z15-gl/s026-t7499-air.jpg`,
   `s028-t7573-air.jpg`), free again ~3 s later. The wreck-pile ramp was driven over without a real jump (`s035-t9296-air.jpg`).
7. **L5 first survivor: still no pointer to Mia.** L5 start, high WebGPU z1.5: "Look for anyone still alive · Survivors found 0/5",
   no marker, no pin, no infected and no NPC in view; the marker-following courier stood at the cellar exit (-79.3, -44.3) for the whole
   5 min (`$S/l5-high-z15-gpu/s010-t3034.jpg`). Walking east along the street finds Mia 49 m away in ~24 s (`l5c-low-z1-gl`). After Mia
   joins the church marker works (42 m, pin to the south, `$S/l5c-low-z1-gl/s010-t2441.jpg`, `s014-t3420.jpg`). Same as r33 P2-9;
   r34-l8qa added the post-Mia marker only.
8. **L8 breach: the courier (and civilians) can leave the plaza far behind during "Protect the group".** High WebGPU z1.5: a kiting
   courier ran from the plaza to x -98 and z 85 while the breach was on; several civilians followed her out (teal bars outside the
   plaza, `$S/l8-start-high-z15-gpu/s027-t8245.jpg`, `s029-t8857.jpg`), "Back to the plaza" appeared at 28-35 m. Infected that
   followed piled up at a fence corner unable to reach her (crop `$S/crop-fence-inf.jpg`). The seal then happened with ~10 infected
   inside the plaza (`s050-t15248.jpg`), a busy fight. Not a soft-lock, but the "plaza" fight is not held in the plaza.

### P3
1. "Rest at the plaza with the group" flicker during Nadia's tour (tick 2772-2986, `$S/l8-start-high-z15-gpu/s009-t2779.jpg`): r33 P3-1, unchanged.
2. A "They're inside!" speech bubble stays on screen for minutes after the breach (ticks 8245 to 21368, three runs: `s027`, `s050`, `s070`;
   `l8-lion-low-z1-gl/s030-t7378.jpg`).
3. Large gate/fence panels hide the courier and her attackers completely (elephant paddock S gate, `$S/l8-gorilla-high-z1-gl/s039-t9623.jpg`);
   in the L4 west breach the courier disappears inside the melee pile (`$S/l4-low-z15-gpu/s023-t5672.jpg`).
4. L5 low WebGL2 z1: the off-screen objective arrow is drawn on top of hotbar slot 1 (`$S/l5c-low-z1-gl/s010-t2441.jpg`, `s014-t3420.jpg`).
5. Driving hint still says "LEFT to horn / boost" (LEFT is not a key name a player knows; on keyboard it is J or LMB now that Space is the handbrake).
6. L8 night infected and corpses still read glassy pale blue (r33 P3-3), e.g. `$S/l8-start-high-z15-gpu/s027-t8245.jpg`.
7. Frame hitches: 1817 ms at L8 tick 7698 (lion run, low WebGL2), 667 ms / 583 ms in L5 low WebGL2 (ticks 9091, 10949), 833 ms at the L10 load.

## Per brief item
### 1. L8 linear route
- **Nadia → plaza → breach**: Nadia ring at the start, toast, tour, lion stop with the tan lion and lioness in frame (fixed:
  `s012-t3691.jpg`). The two service hatches make the breach a real fight: runners from the hatch at tick 5823, courier HP 100 → 21
  with the bat, civilians' bars in the melee (`s019`, `s020`). Seal at tick 15108 with soldier line "Plaza is sealed. Through the pond gate",
  checkpoint `sealed`.
- **Flamingo**: pink now (fixed, `s055-t16770.jpg`); birds fly over the lane. A bat-only courier died 6 times in 6 min (retries restart
  at `arena-flamingo` with HP 100 and the group: checkpoints work). Not cleared in my run.
- **Lion**: the leg marker walks the service path (east, south, west); fight starts when the courier steps into the enclosure
  (tick 2053, "A low growl behind the rocks - watch for the pounce"). In 450 s of god-mode MG the lion went 246 → 89 because my
  tool aimed at runners pressed against the outside of the fence; no amber pounce ring fell inside a 4 s capture, so the arena ring is
  still only proven in Scene Lab (r34). No red chevron lane under the lion in the frames I opened.
- **Gorilla**: reads as a dark ape with a red chest wound at high zoom 1; P1-1 gate escape.
- **Elephant**: reads (grey, ears, trunk, tusks, wound) at high WebGL2 z1.5 (`sheet-l8-animals.jpg` 6).
- **Monkey, zebra**: not reached (no fixture; lion not cleared). Zebras did appear as enemies in L9 (logs), not captured.
- **Readable gates / stuck / lost**: hedge + jersey lines read as barriers; the marker always pointed to the next node in my runs
  (off-screen arrow east on the lion leg, back to the plaza after the breach). Stuck spots seen were the straight-line tool on a
  planter at (-27, -55) and the perimeter wall, not route design.

### 2. Heavy zombies (L4)
Scene Lab (`sheet-heavies-scene.jpg`): at L4 dusk, both backends, zoom 1 and 1.5, every heavy has its own body: butcher (biggest, white
chef cap, apron, cleaver), brute (bulky, orange vest), armored (helmet with visor, plates, olive), bloated (red apron belly, pustules),
screamer (thin, pale gown, open jaw). At night the colours wash to lilac grey; silhouettes carry the read (butcher cap + cleaver, brute
bulk, armored helmet), bloated and screamer read as ordinary-size infected. In L4 real play (low WebGPU z1.5) butchers and brutes are easy
to pick out at the west wire (`$S/l4-low-z15-gpu/s013-t3213.jpg`); in the breach melee everything merges (`s023`). Butchers carried up to
1314 HP in the log (armored 600, brute 450).
Verdict: distinct and tough-looking by day; at night only by silhouette.

### 3. L9 after polish
- **Controls / Space handbrake**: hint "swerve or handbrake (Space) while moving"; with Space taps boarders were thrown off in
  0.2-1.5 s every time ("Shake off boarders" → "Drive" within 11-90 ticks, log). K still works (stall run).
- **Jumps**: APC airborne on both road ramps (apcY 2.69 overpass, 2.44 wreck pile); overpass landing issue P2-6.
- **Bay**: evacuation starts in the NE corner (stopped at (456, 30)) and on the lane (451, -19): works.
- **Hatch**: MG fight from the hatch, HP 90-100, weapon key works at the hatch (HUD slot 5 lit; the tool's `current` read stays stale).
- **Bridge crawl**: ends in the ring in both full runs (upgrade screen / L10). Infected idle around the crawl: P2-4.
- **No APC pin**: none (longest stop ~25 s in the horde off-road, then free).

### 4. L5
First rescue reachable in ~24 s if the player walks east; no pointer before Mia (P2-7); church marker after Mia works. Calm, no infected
on the way (as in r33/r34; the corridor rule).

## "Is it stunning?" / "boring, harmless, babysitting?"
- L8: night zoo, lamp pools, pink flock and the breach crowd look good; the plaza fight is busy and dangerous now. Not stunning: the lion.
  Boring for a melee player: the flamingo fight (6 deaths with the bat). Harmless: infected stuck at fence corners outside enclosures.
- Heavies: good by day, the butcher is the standout; at night they need their silhouettes.
- L9: driving with jumps, throwers, boarders and the convoy reads as an action set piece; harmless: the crawl crowd; swingy: armour at
  the floor by the first minute in my run, then 4 min without APC stakes.
- L5: calm, but the first minute is empty and gives no direction.

## Tooling (QA only, committed)
`tools/qa/r28-vqa-fixture-play.ts`: `--handbrake` (default Space since 258f211b; `KeyK` to test K), `--idle-when <regex>` (let go of all
keys while the objective matches), `--prefer <regex>` (aim at a boss before a runner pressed to the far side of a fence), `--route-when
<regex>` (hold the route until the objective matches, e.g. after the L5 cellar), weapon-key retry on foot (the first press lands under
the briefing panel). Tracker distances use a no-break space before "m": match it with `.` in regexes.
