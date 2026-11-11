# r38-vqa: real-play visual QA of PROD batches 76-78 (2026-11-11, Opus)

Build: main 6bf0433a (+ QA tooling only), `npm run build:qa`, `vite preview` on 4931. One headless browser at a time through
`tools/e2e-lock.sh` (browser pool); every run <= 10 min. Real input = key presses and mouse via `tools/qa/r28-vqa-fixture-play.ts`
(level start `level:<L>[:<checkpoint>]` or a QA fixture in `tests/fixtures/saves/qa`). Same method as r35-vqa.

Captures (raw, not in git) and the PO sheets: `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r38-vqa/`
(below `$S`). Every capture cited here was opened. Caveat for all frame-time numbers: another lane (s37-hitches) ran browser
perf jobs on the same Mac during my runs, and my own screenshots stall a frame by ~100-300 ms.

## Sheets for the PO
| Area | Sheet |
|---|---|
| L8 gorilla gate (x-ray), gorilla in the corner, Rest / breach "Back to the plaza!", monkey gate stop | `$S/sheet-l8-route.jpg` |
| L8 animals: lion/lioness (low WebGPU z1), gorilla crops, monkey burst | `$S/crop-lion-low-z1.jpg`, `$S/crop-gorilla.jpg`, `$S/burst-monkey-s004.jpg` |
| Zombie strikes / recoil bursts (L8, L4, L10) and the L4 bus pile | `$S/sheet-zombies.jpg` |
| L4 north street: Harbor St run, heavy + Alpha group, cellar | `$S/sheet-l4.jpg` |
| L9 bridge / hull stall, L10 console explosion and invisible courier | `$S/sheet-l9-l10.jpg`, `$S/l10-repro-seq.jpg` |
| L9 collapse and crawl, L10 start | `$S/l9-crawl-seq.jpg` |
| L8 zebra herd at night (rear kick, ring) | `$S/burst-zebra-s023.jpg` |
| L5 first rescue marker | `$S/sheet-l5.jpg` |

## Runs (matrix actually covered)
| Run (`$S/<dir>`) | Start | Quality | Zoom | Backend | Notes |
|---|---|---|---|---|---|
| l8-gorilla-high-z15-gl | l8-before-gorilla, god, r35 P1 route (inside the exit gate, then east) | high | 1.5 | WebGL2 | 480 s |
| l8-lion-low-z1-gpu | l8-before-lion, god, marker | low | 1 | WebGPU | 420 s: lion cleared, then 3.5 min at the monkey gate |
| l8-monkey2-high-z1-gl | l8-before-monkey (new fixture), god, route into the yard | high | 1 | WebGL2 | 400 s: monkey cleared |
| l8-start-high-z1-gpu | L8 level start, god, marker; during the breach route out of the plaza and back | high | 1 | WebGPU | 420 s: Nadia, rest, breach, seal |
| l8-monkey-xray-low-z05-gpu | l8-before-monkey, zoom 0.5 | low | 0.5 | WebGPU | 110 s; my --dwell kept her on the boulevard: x-ray at 0.5 not reached |
| l8-zebra-low-z15-gpu | l8-before-zebra (new fixture), god, route into the paddock | low | 1.5 | WebGPU | 300 s: zebra herd cleared in ~140 s |
| l4-north-low-z1-gl | level:L4:line-break, god, marker | low | 1 | WebGL2 | 540 s: pinned behind the EVAC bus (tool) |
| l4-west-high-z15-gpu | level:L4:line-break, setup `killAll + teleport (-19,-22)` (logged, as r37), route Harbor St west | high | 1.5 | WebGPU | to the cellar and the upgrade screen in 28 s |
| l9-stall-high-z1-gpu | l9-before-rail-stall, god, marker driver | high | 1 | WebGPU | 400 s: hatch, bay, 296 s on "Drive onto the bridge" |
| l9-start-low-z15-gl | L9 level start, god, marker driver | low | 1.5 | WebGL2 | 300 s: to the bay |
| l5-low-z1-gl | L5 level start, handgun, no god, marker | low | 1 | WebGL2 | 150 s: Mia found |
| l10-console-high-z15-gl | l10-dispersal-console, god | high | 1.5 | WebGL2 | 200 s: page-error stream, invisible courier |
| l10-repro-high-z15-gl | l10-dispersal-console, god (repro with error stacks) | high | 1.5 | WebGL2 | 100 s: P1-1 reproduced |
| l9-crawl-high-z15-gpu | l9-at-bridge, no god | high | 1.5 | WebGPU | 150 s: collapse, crawl, L10 start |

New QA fixtures (committed): `tests/fixtures/saves/qa/l8-before-monkey.json.gz`, `l8-before-zebra.json.gz`
(`tools/qa/make-checkpoint.ts --what qa --qa-parts l8` now also writes them).

## Prioritised findings
### P1
1. **L10 console: after the Mega Alpha's grab-throw the courier is no longer drawn, and every gunshot throws a page error.**
   Reproduced 2 of 2 (`l10-console-high-z15-gl`, `l10-repro-high-z15-gl`; fixture l10-dispersal-console, high, WebGL2, zoom 1.5,
   god). The Mega does `alpha.grab-throw` at tick ~480-520 next to the console, an explosion follows at tick ~630, courier HP drops to
   80 (god on). From then on the courier is invisible: only the corgi is at the camera centre while the courier keeps moving and firing
   (`$S/l10-repro-high-z15-gl/s007-t773.jpg`, `s008-t921.jpg`, `s012-t1514.jpg`, `s023-t3127.jpg`; first run
   `$S/l10-console-high-z15-gl/s005-t1378.jpg`, `s012-t3929.jpg`). The sim pose stays finite (x/z, y 0.71 logged). 2277 and 758 page
   errors, one per shot, all `RangeError: Query position and radius must be finite, radius nonnegative` from
   `N3.gunshot -> K3.ray -> K3.nearby -> query` inside the combat.attack handler (stack in `l10-repro-high-z15-gl/log.jsonl`).
   It looks like the courier's drawn skeleton/muzzle goes NaN after the throw (sim fine, render not). Not checked: low, WebGPU,
   without god, PROD b75 (regression or not); s34-zombiehits (Alpha-style attack presentation) and s35-l10stack are the b77 changes
   near this.

### P2
1. **L9 "Drive onto the bridge": the marker sits at the bridge gate, behind the trigger.** l9-before-rail-stall, high WebGPU z1, marker
   driver, god: after the evacuation (tick 6239) the objective stayed for 296 s, to the end of the run. The APC reached the deck at
   (492.5, 3.3) at tick ~6900 (inside the collapse box x 482-508, |z| < 6), was stopped there by boarders (speed 0, "Shake off
   boarders"), and the tracker said "23 m" with the arrow pointing back west (`$S/l9-stall-high-z1-gpu/s024-t7108.jpg`). The collapse
   needs the APC moving east (> 1 m/s) inside the box; the marker point is at the gate (~x 470: "2-3 m" whenever the APC passes x 468-470).
   From then on the marker driver circled the gate in a crowd of 20+ infected incl. armored, brutes and an Alpha (`s042-t10503.jpg`).
   A human probably drives on east, but the HUD tells her to turn back the moment she is on the bridge. Same symptom as r35 P2-3 (the
   r36 boost did not help this case). The APC was "barely functional" from the bay on (the fixture starts at 430/1000).
2. **L9 APC stands still for 53 s with two hull leapers, nose on a jersey barrier.** L9 level start, low WebGL2 z1.5, god: ticks
   5381-8534 at (292, 0), speed 0, W held, Space taps, 2 boarders, an Alpha (300 HP) at 2 m, armour floored by tick 6301
   (`$S/l9-start-low-z15-gl/s031-t6033.jpg`: APC nose on a concrete barrier, school bus behind, infected pile at the rear). The stuck
   recovery did not reverse it out in 53 s. A player would press S; the marker driver never does. No ramp jump in this run either (the
   driver stays on the road), so the overpass landing (b76) is NOT verified by real input.
3. **L8: every arena leg's marker ends 4 m outside the entry gate; the fight only starts inside.** l8-before-lion, low WebGPU z1: after
   the lion the courier followed "Take the west boulevard to the primate yard" to "1 m" / "0 m" at (-24.5, 3.3) and stood in the ring for
   3.5 min (ticks 12843-25243) with nothing happening (`$S/l8-lion-low-z1-gpu/s057-t17053.jpg`). Same in l8-monkey-high-z1-gl (60 s at
   (-24.3, 3.9)). In `l8Route` the last node of each leg is 4 m short of the gate (monkey node z 4, gate z 8, zone from z 9; lion -56 vs
   -52; zebra 56 vs 52; gorilla -8 vs -12), while the comment says "the last one is just inside its entry gate". With a route 8 m
   further the monkey fight engaged at once (tick 752, `l8-monkey2-high-z1-gl`).
4. **L8 gorilla parks in "chase" 4.3 m from the courier for 3 min.** l8-before-gorilla, high WebGL2 z1.5, god: courier in the arena's
   NE corner (80.6, -12.7), gorilla at 4.3 m in state chase from tick 10343 to the end (tick 20838), no attack on her or on the group
   members packed between them (`$S/l8-gorilla-high-z15-gl/s045-t13744.jpg`, `s052-t15862.jpg`). A harmless boss while the courier
   hugs a corner behind her own group.
5. **L4 north street: the new heavy groups can be outrun.** level:L4:line-break (setup killAll + teleport (-19,-22), as r37), high
   WebGPU z1.5, god, route Harbor Street west: plaza exit to the cellar in 18 s (ticks 69-1140). The Alpha + brute + riot group met her
   at (-60, -38) (Alpha at 1.3 m, `$S/l4-west-high-z15-gpu/s003-t799.jpg`) and the heavies trailed her to the cellar door (5-6 m behind
   at "Bar the cellar door", `s004-t1040.jpg`); group 18 at (-48, -39) never reached her. Good look and a real chase, but a gauntlet
   you can sprint through (r37 said the same). Not checked: without god (does she survive), the east loop (group 20).
6. **Frame hitches:** 4050 ms at L9 tick 10389 (hatch defence) and 3216 ms at tick 6460 (hull Alphas), low WebGL2 (`l9-start-low-z15-gl`);
   600 ms in the L8 monkey yard melee (tick 10829, high WebGL2); 833/783 ms at the L9 -> L10 load. Another lane's perf jobs shared the
   Mac: re-measure in a quiet window before acting.

### P3
1. L8 gorilla at night reads pale grey-green with a red chest (yeti-like), not a dark ape, under the lamp (`$S/crop-gorilla.jpg`).
2. L8 lion/lioness now read as big cats (mane hood, muzzle, tail tuft; the lion corpse is clearly a lion,
   `$S/l8-lion-low-z1-gpu/s042-t12512.jpg`), but at low quality the coat is a flat, full-bright ochre at night with soft "rubber"
   joints (`$S/crop-lion-low-z1.jpg`).
3. L8 zebras read clearly (stripes, rear kick, ring) but glassy pale green at night like the infected (r35 P3-6), `$S/burst-zebra-s023.jpg`.
4. Behind the L4 EVAC bus the courier is drawn in full over the roof (x-ray) and reads as standing on the bus
   (`$S/l4-north-low-z1-gl/s035-t6636.jpg`); the 20-body pile behind it is a stack of health bars.
5. L4 cellar: the prompt alternates "Hold still or press E" / "Bar the cellar door" (ticks 1158-1308).
6. L8 gorilla fight tracker shows "Phase 1 · 21-28 m", which is not the distance to the gorilla (2-4 m away).

## Per brief item
### 1. L8 (b77)
- **Gorilla gate (r35 P1): fixed.** The courier stood against the closed exit gate at (81.4, -29..-31) for 120 s with the gorilla
  attacking at 1-3 m (ticks 920-8142) and never got past x 81.4; then the route moved her north inside the arena.
- **Gold x-ray outline:** yes at the gorilla exit gate, high WebGL2 z1.5 (courier drawn gold behind the keeper fence, `crop-gorilla.jpg`
  1-3), also inside the L4 heavy pack and behind the L10 tank. Zoom 0.5: not reached (my dwell setting), open.
- **Breach:** "Protect the group!" at tick 5747; the courier ran to x -28: "Back to the plaza! The group is under attack · 25 m" at 6578
  with the group following her (`l8-start-high-z1-gpu/s022-t6686.jpg`); back in the plaza "Protect the group!" at 7497; sealed at 8453
  (30 s hold + ~14 s away: the hold paused). "They're inside!" only as short single bubbles (5887, 7759, 18673), never stuck.
  "Rest at the plaza with the group": one appearance at 4838, no flicker.
- **Lion/lioness at night:** P3-2; the amber ring shows at the pounce (`l8-lion-low-z1-gpu/s037-t11266-b2.jpg`) with the "A low growl
  behind the rocks - watch for the pounce" caption; lion pair cleared at tick ~12540 (god + MG).
- **Monkey / zebra fixtures:** built with `make-checkpoint.ts` and played: monkey pack cleared in ~36 s (leader line "The leader is coming
  out - stop him to scatter the pack!"), zebra herd in ~140 s with armored infected roaming the paddock. Both engage only after
  stepping through the gate (P2-3).

### 2. Zombies (b77 render)
Bursts of 6 frames ~100 ms apart when a drawn infected within 3-6 m attacks (`sheet-zombies.jpg`): runners reach up with an arm while
closing (L8 breach, `s023-t6799-b3`), a runner lunges flat at the courier (L4, `s003-t870-b3`), the armored at the L10 console step in
with arms forward. Recoil is hard to read in stills at game speed; no foot sliding seen on runners, armored, dogs or the L4 crawler in
the frames I opened (no nurse met). L10 football (armored) zombies: helmets and plates read, no flat pale patches
(`burst-l10-s002.jpg`, high WebGL2 z1.5). Caveat: the tool aims at the chest point, which projects behind a target closer than ~1.5 m,
so point-blank hit reactions were rare and close-range infected often kept full HP.

### 3. L4 north street (b78)
P2-5. The heavies look distinct and dangerous in daylight (brute, riot shields, butcher 1126 HP, hazmat, Alpha); no clipping or stuck
heavies seen; the group engages and follows to the cellar door. No frame > 200 ms in that run. The marker-following run
(`l4-north-low-z1-gl`) got pinned behind the EVAC bus at the line-break by ~20 infected for 9 min (god on, tool aim): not a game finding.

### 4. L9 (b76)
- Bay -> bridge: P2-1 (296 s, marker behind the trigger).
- APC armour: fixture 430 -> "barely functional" before the bay; level start 1000 -> 657 at 56 s -> 445 at 78 s -> floored at ~105 s
  (marker driver, god). Still at the floor long before the bay.
- Landing after the overpass jump: not verified (no ramp taken).
- Crawl: fixed. The collapse took the pack; the crawl ran with nobody next to her and ended in the ring ("Everything went into the river.
  Almost everything.", `l9-crawl-seq.jpg`), then L10 started.

### 5. L5 (b76)
Fixed: from "Look for anyone still alive" the tracker counts down to Mia (43 m -> 3 m in ~10 s) with the minimap pin east; Mia found at
tick 1576; the off-screen arrow sits above the hotbar at the bottom left (`sheet-l5.jpg`). After Mia my driver stood still at "31 m"
(tool; r35 showed the church marker works).

## "Is it stunning?" / "boring, harmless, babysitting?"
- L8: the night zoo with lamp pools, the breach crowd and the zebra dust lanes look good; the big cats finally read as cats. Boring:
  standing in an arena-gate ring with nothing happening (P2-3). Harmless: the gorilla parked behind the group (P2-4).
- L4: the north-street gauntlet with an Alpha, brutes and riot shields at the open crossing is the best-looking fight of the batch, but
  short if you sprint.
- L9: driving set pieces are busy; the bridge approach is the weak spot (P2-1), and the APC is at the floor within two minutes.
- L10 console: P1-1 breaks the scene (invisible heroine).
- L5: the first minute now has a direction.

## Tooling (QA only, committed)
- `tools/qa/make-checkpoint.ts`: L8 also writes `l8-before-monkey` and `l8-before-zebra` (`--what qa --qa-parts l8`).
- `tools/qa/r28-vqa-fixture-play.ts`: `--burst <m>` (6 quick frames when a drawn enemy within m metres attacks), `barks` (visible
  "They're inside!" / "Reloading!" / "Behind us!" bubbles) and `py` (courier y) in the 3-s log, stacks of the first 3 page errors.
- A `--route` whose first value is negative must be passed as `--route=-32,0;...` (parseArgs). `--dwell` applies at every route point.
