# r33-vqa: visual QA by real input before the PO's morning play (2026-11-11, Opus)

Build: main 713d8017 (`npm run build:qa`, `vite preview` on 4925). One headless GPU browser at a time through
`tools/e2e-lock.sh` (browser pool), every reservation under 10 min. Real input = key presses and mouse via
`tools/qa/r28-vqa-fixture-play.ts` (QA fixture or `level:<L>` start), plus two small probes written for this lane:
`tools/qa/r33/drivekeys.ts` (holds W/A/D/S/arrows, logs yaw and the nose direction projected on screen) and
`tools/qa/r33/aggro-bars.ts` (stages a runner chasing a cashier, then shoots it with a real mouse aim + Space).
Isolated moves: Scene Lab specs `specs/scenes/r32-alphas/*-game-night.json` and `specs/scenes/r32-animalmoves/*-game.json`
(L8-zoo night preset, game camera zoom 1.5) with `--shots`.

All captures (raw, not in git) and the PO sheets are under
`/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r33-vqa/`
(below: `$S`). Every capture cited here was opened.

## Sheets for the PO (one per area)
| Area | Sheet |
|---|---|
| L8 Nadia start, toast, lion stop, plaza ring | `$S/sheet-l8-nadia-plaza.jpg` |
| L8 animals in real play (flamingo, lion, gorilla, elephant, corpses) | `$S/sheet-l8-animals-play.jpg` |
| L8 animal signature moves, Scene Lab, night | `$S/sheet-animals-scene-night.jpg`, close-up `$S/sheet-lion-redlane.jpg` |
| Alphas, each type at night, low, WebGPU, zoom 1.5 | `$S/sheet-alphas-night-low-gpu.jpg` |
| L9 keys, leapers, durability, stall, bay, crawl | `$S/sheet-l9.jpg`, bridge `$S/sheet-l9-bridge.jpg` |
| L5 first rescue | `$S/sheet-l5.jpg` |
| L4 shot-zombie engage + health bars | `$S/sheet-l4-aggro-bars.jpg` |

## Runs (matrix actually covered)
| Run | Level / fixture | Quality | Zoom | Backend | Length |
|---|---|---|---|---|---|
| l8-start-high-z15-gpu | L8 level start (fresh), god | high | 1.5 | WebGPU | 470 s (Nadia walk, plaza, breach, flamingo arena) |
| l8-lion-high-z15-gpu | l8-before-lion + staging (below) | high | 1.5 | WebGPU | 240 s |
| l8-gorilla-low-z1-gl | l8-before-gorilla + staging | low | 1 | WebGL2 | 220 s |
| l8-elephant-low-z15-gpu | l8-elephant-apc-yard-engaged | low | 1.5 | WebGPU | 150 s |
| l9-drivekeys-low-z15-gpu | l9-before-rail-stall, key probe | low | 1.5 | WebGPU | 40 s of keys |
| l9-start-high-z1-gl | L9 level start, god, marker driver | high | 1 | WebGL2 | 420 s (start to rail stall) |
| l9-stall-low-z15-gpu | l9-before-rail-stall, no god | low | 1.5 | WebGPU | 200 s (stall, bay) |
| l9-bridge-high-z15-gpu | l9-at-bridge, god | high | 1.5 | WebGPU | 150 s (bridge fall, crawl) |
| l5-rescue-low-z15-gpu | L5 level start, no god, handgun | low | 1.5 | WebGPU | 420 s (cellar to Mia) |
| l4-aggro-low-z15-gpu | L4 level start, probe | low | 1.5 | WebGPU | 5 trials |
| Scene Lab alphas2/* | 6 Alpha types, game-night | low | 1.5 | WebGPU | 180 frames each |
| Scene Lab animals2/* | 7 animals, L8-zoo night | high (+ lion, gorilla low WebGL2) | 1.5 | WebGPU (+WebGL2) | 640-760 frames |

Not covered: low+high and both backends for every area (time), zoom 1 for most areas, L8 zebra/monkey arenas and
the L4/L5/L6/L7 in-level Alphas in real play, L9 jumps (my marker driver never hit a ramp: no frame with the APC
above y 2.2).

Staging note (L8 lion/gorilla): the `l8-before-lion` / `l8-before-gorilla` fixtures are pre-breach saves (all arenas
phase 0, Nadia's walk). To reach the fights I ran `--setup` once: `missions.l8.advance()` (debug breach), earlier arenas
set to phase 3, the target arena's animals infected. Objective text in those two runs ("Follow Nadia ... · Lion and
lioness · Phase 1") and pre-engage immunity are artefacts of that staging, not findings.

## Prioritised findings

### P1
None confirmed by real input. Two candidates need one manual check by the PO or a follow-up lane (each is listed
below as P2 with the exact repro): L9 evacuation-bay pin (W held 95 s, APC did not move) and the L9 bridge crawl ring
that never completes when the player stops inside it.

### P2
1. **Lion/lioness pounce still draws the red chevron lane** (PO: "this red arrow and then coming fast is the same that any
   alpha is doing. Super lame"). Scene Lab `r32-animalmoves/lion-game` f620 and `lioness-game` f140/f300, high WebGPU and
   low WebGL2: a red-orange chevron lane under the leap, the same marker the Alphas use. Captures
   `$S/animals2/lion/shot-0620.png`, `$S/animals2/lioness/shot-0300.png`, `$S/animals2/lion-low-gl/shot-0620.png`, sheet
   `$S/sheet-lion-redlane.jpg`. r32-animalmoves says the arena pounce uses an amber ring; the Scene Lab path (shared,
   non-arena pounce) still uses the lane. In my real-play lion run no pounce fell inside a 2 s capture, so the arena
   path is unverified. Fix or confirm the shared path never runs for L8 lions.
2. **Lion still reads as a dark shaggy ball at night, not as a lion.** Real play L8 high WebGPU zoom 1.5
   (`$S/l8-lion-high-z15-gpu/s005-t706.jpg`, `s011-t1456.jpg`) and Scene Lab (`animals2/lion/shot-0220.png`): a round
   grey-black mane disc with thin legs and red eyes, no tan body colour; the lioness is a black panther shape. It is no
   longer a flat blob (rim light separates mane and legs, s33-nightread), but "is it a lion?" at game zoom is still no.
   Elephant (grey, ears, trunk, wound), zebra (stripes) and gorilla (dark ape, arms up in the pound) do read.
3. **Flamingos are grey-blue, not pink.** Real play L8 flamingo arena, high WebGPU zoom 1.5 (`$S/l8-start-high-z15-gpu/s030-t7333.jpg`,
   crop `$S/crop-flam.jpg`): the shape reads (curved bill, long neck, thin legs, red eyes, blood) but the colour reads as
   herons. Same in Scene Lab `animals2/flamingo`.
4. **L8 lion-stop line plays with no lion on screen** (PO: "What is this?"). Real play, tick 3680, courier at (-37.7, 0.4),
   high zoom 1.5: subtitle "Nadia: Sixteen years old. Grumpiest cat in the state." while nothing in frame is a lion
   (`$S/l8-start-high-z15-gpu/s015-t3680.jpg`, crop `$S/crop-lionstop.jpg`). The lion arena entry is ~24 m away, out of
   frame at zoom 1.5. Not fixed in play.
5. **L9 leapers drain the APC to the durability floor in the first minute; the remaining ~3 min have no APC stakes.**
   L9 start, high WebGL2 zoom 1, real keys (W toward the marker, A/D steering, Space handbrake taps every 1.5 s while
   boarded): armor 1000 at 0 s, 740 at 29 s, two leapers on the hull from 34 s, 180 CRITICAL at 45 s, "APC barely
   functional" at 55 s, and it stays there to the rail stall at 190 s (`$S/l9-start-high-z1-gl/s025-t2778-*.jpg`,
   `s039-t3789-*.jpg`, log `apcBar`). The handbrake taps did not throw the leapers off for ~13 s. Either the shake-off is too
   hard to trigger by keys or 30 per 1.5 s per leaper is too much; "real fight action" then turns harmless.
6. **L9 rail-stall hatch: courier killed four times in ~85 s, and god mode did not protect her.** L9 start run, high
   WebGL2, `--god` on: at the hatch HP 100 → 0 in ~13 s, restart, repeat (ticks 11354-16706), with ~18 infected stacked
   at the hull and their bars piled up (`$S/l9-start-high-z1-gl/s149-t14381.jpg`). Caveat: the play tool did not attack
   from the hatch in that run (it only fired on foot; fixed afterwards for the stall run, `tools/qa/r28-vqa-fixture-play.ts`),
   and the weapon was the bat because number keys do not switch weapons while in the APC. Fairness is therefore not
   judged; two facts stand: the god cheat is bypassed at the hatch, and the weapon cannot be changed once in the APC
   (r32-l9fun saw the same with the launcher).
   The stale `l9-before-rail-stall` fixture (no god, old loadout, held the launcher) cleared the stall at 100 HP in 30 s.
7. **L9 evacuation bay: APC pinned 95 s, 5 m from the bay.** `l9-before-rail-stall`, low WebGPU zoom 1.5, no god:
   "Stop in the evacuation bay · 5 m", APC nose against a parked sedan with ~10 infected on the right flank; W held
   (with A/D steering) from tick 6168 to 11903, position constant to 4 decimals (x 475.195), durability to the floor, the
   3 s stuck recovery never reversed it (`$S/l9-stall-low-z15-gpu/s060-t7533.jpg`, `s084-t10531.jpg`). A real player
   would press S; one manual check needed. If S also fails it is a P1 soft-lock.
8. **L9 bridge crawl: the ring is reached but the step never completes when the player stops in it.** `l9-at-bridge`,
   high WebGPU zoom 1.5: bridge, fall, "Crawl out of the wreck", courier crawls to the marker, objective "· 1 m", courier
   inside the yellow ring for 2+ min, nothing happens (`$S/l9-bridge-high-z15-gpu/s008-t1003.jpg`, `s010-t1252.jpg`). In
   `LevelNineCrash` the crawl only advances with forward input until `crawlProgress` = 1; the ring at `crawl-end` tells
   the player they have arrived. A player who lets go inside the ring waits forever.
9. **L5 first rescue is now safe but empty.** L5 start, low WebGPU zoom 1.5, no god, real input: cellar → Mia (49 m) →
   Mia following in ~27 s, HP 100, **zero infected drawn on screen during the whole run** (log `enemies` empty every
   sample; `$S/sheet-l5.jpg`). r31-l5rescue asked for "calm but not empty (distant infected visible)": it is empty. After
   Mia joins, the objective stays "Look for anyone still alive · Survivors found 1/5" with no pointer to the church;
   on the earlier attempt the courier stood 200 s at the cellar exit with no visual cue toward Mia (sound not
   checked, headless runs are muted). Answer to "can a normal player rescue Mia?": yes, easily, if they find her.
10. **Frame hitch 1917 ms** on L9 at tick 3213 (high, WebGL2), during the second leaper pair's windup; 450 ms at tick 11627
    (rail stall). Log `$S/l9-start-high-z1-gl/log.jsonl` (`frames`). L8 high WebGPU had no frame over 100 ms in 470 s.

### P3
1. L8 objective flicker while Nadia leads past the plaza: "Rest at the plaza with the group" for ~4 s at tick 2773, then
   back to "Follow Nadia ..." (`$S/l8-start-high-z15-gpu/s012-t2944.jpg`).
2. Long objective text in arena fights wraps to 4 lines in the tracker box and covers the arena entry ring at zoom 1.5
   (flamingo, elephant; `s030-t7333.jpg`, `l8-elephant-low-z15-gpu/s024-t3030.jpg`). Flamingo health bars overlap the
   minimap.
3. Night corpses and infected in L8 read as glassy pale-blue figures (strong rim) (`$S/crop-corpses.jpg`).
4. L9 damage smoke ("barely functional") is a large grey sphere cloud that hides most of the APC hull and the hatch at
   zoom 1 for the rest of the level (`$S/l9-start-high-z1-gl/s039-t3789-*.jpg`, `s058-t7291.jpg`).
5. QA fixtures are stale: `l8-*` fixtures still hold the rocket launcher (hotbar slot 7) and the engaged elephant has
   4804 HP (r31-flamingo design: 1200); `l9-before-rail-stall` holds the launcher and predates the r32 set pieces;
   `l8-before-lion/gorilla` are pre-breach saves. Re-pack them (`tools/qa/make-checkpoint.ts`).
6. Health bars on a stack of ~18 infected at the L9 hatch form an unreadable red block (`s149-t14381.jpg`).

## Per PO complaint: fixed in play?
| PO complaint | Verdict | Evidence |
|---|---|---|
| L8 Nadia "running away right from the start", ring | Fixed. Nadia ~5 m at t0, ring and arrow on her, leads at walking pace, group follows, plaza ring holds Nadia + group, Hale greets inside | `sheet-l8-nadia-plaza.jpg` 1, 3, 6 |
| "What is this?" (lion line, no lion) | Not fixed: line plays at the lion stop, lion off screen at zoom 1.5 | P2-4 |
| Launcher hand-in toast | Works: soldier subtitle at spawn, toast ~4 s later, centred, does not cover the tracker; hotbar 1-6 on a fresh start | `sheet-l8-nadia-plaza.jpg` 1-2 |
| "This is the lion...." flat blob | Partly: not flat any more, still not lion-like | P2-2 |
| "the entire movement is creepy", "no special attacks and no lion-like movements" | Partly: crouch/leap/landing ring and roar exist (r32 captures), but the pounce marker is still the red Alpha lane in Scene Lab; real-play pounce not caught on camera | P2-1 |
| Flamingos "just slide in" | Looks fixed: in Scene Lab the flock flies over the courier with ground shadows; in real play the birds hover/fly over the pond in wing poses. The arena shadow-line dive itself was not caught in a capture | `sheet-animals-scene-night.jpg` flamingo row; `s030-t7333.jpg` |
| Elephant "not doing anything" | Fixed: stamp ring, dust trail, charge; reads as an elephant | `sheet-l8-animals-play.jpg` 8-9 |
| Gorilla | Pound windup (arms up) and tan shock ring readable at low WebGL2 zoom 1 | `sheet-l8-animals-play.jpg` 6; Scene Lab gorilla f300 |
| Bosses not tanky | Lion: 250 → 74 HP in ~3 s of MG during phase 2, 32 HP at ~4 s (consistent with ~1 MG magazine). Flamingo 1 shotgun shell: not verified (my tool held the bat in that run) | `l8-lion-high-z15-gpu/log.jsonl` |
| Alphas "all the same" | Fixed: distinct look per type (Armoured orange helmet/bulky, Brute pale and biggest, Leaper dark suit and crouched, Screamer hoodie, Thrower hard hat) and distinct telegraphs (bash arc, charge lane, slam ring, pounce lane, roar ring that calls infected, throw marker with a living missile) at zoom 1.5, night, low | `sheet-alphas-night-low-gpu.jpg` |
| "ultra hard to kill" suit zombie | The suit look is now only the Leaper, always with a bar, crouched, smaller; at night it is the darkest of the five and the least readable without its bar | same sheet, row 4 |
| L9 "driving fun ... real fight action" | Mixed: leaper windup/cling, throws with markers, roadblock barricades, smash junk all appear in play; durability floor after 55 s and the hatch death loop make it swingy (P2-5, P2-6); jumps not seen by my driver | `sheet-l9.jpg` |
| L9 controls "w forward / s brake / a left / d right" | Fixed. W+A turned the nose to the driver's left at every heading the circle passed (screen right, up, left), W+D to the right, arrows identical, S reverses, reverse + A swings the nose clockwise | `l9-drivekeys-low-z15-gpu/log.jsonl`, `sheet-l9.jpg` 1-2 |
| L5 "cannot rescue my 1st survivor. Too many Zombies" | Fixed, perhaps over-corrected: no infected seen at all on the way to Mia | P2-9 |
| Health bars only when shot/engaging (L4) | Holds: shot runner shows a bar at +150 ms, the untouched runner 9 m away and the missed ones show none; survivors keep teal bars | `sheet-l4-aggro-bars.jpg` |
| Shot zombie turns to the courier (L4) | 1 of 1 hit trial: runner chasing a cashier at 1.8 m, hit at +150 ms → target = courier, facing 0° at +400 ms. 4 other trials missed (handgun at 4.7-7 m), so 1 sample only | `l4-aggro-low-z15-gpu/log.jsonl` |

## "Is it stunning?" / "boring, harmless, babysitting?"
- L8: the night zoo with lamp pools, fireflies and the flock overhead looks good; the plaza crowd and the flock fight are
  busy. Boring: the flamingo fight with melee only (the birds stay over the pond; 5.8 min without progress for a
  bat-only player). Not stunning: the lion.
- Alphas: readable and different now; the telegraph shapes carry the read more than the bodies do at night.
- L9: the set pieces make the road busy; harmless after the durability floor; the hatch fight is a pile of bars.
- L5: calm and readable, but the first two minutes have nothing to fight or see.

## Tooling changes (QA only, not committed)
`tools/qa/r28-vqa-fixture-play.ts`: closes the briefing with `mission-button` (it clicked a test id built from the label
and timed out 30 s), fires with the mouse at the L9 hatch and retries the weapon key there, `--reach`/`--block` route
options and close approach to route points. New: `tools/qa/r33/drivekeys.ts`, `tools/qa/r33/aggro-bars.ts`.
These stay uncommitted in the lane worktree (brief: commit only README + summary).
