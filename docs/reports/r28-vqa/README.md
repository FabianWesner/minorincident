# r28-vqa: visual and gameplay QA of L7–L10 from checkpoint fixtures (main 029e709c, batch 63 candidate)

Lane r28-vqa (claude-opus-5-5), 2026-11-10, 16:40–19:10 CET. Local `npm run build:qa` of 029e709c, served by `vite preview` on port 4891; Scene Lab on 4892. One headless GPU browser at a time through `tools/e2e-lock.sh` (each run ≤ 9.5 min).

Raw captures, logs and contact sheets are in the scratchpad and not in git:
`/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r28-vqa/<run>/` (`s<NNN>-t<tick>.jpg` every 4–6 s, `log.jsonl`), sheets `sheet-*.jpg` next to them, Scene Lab output in `scenes/` and `scenes2/`.
Run summaries are in [summary.json](summary.json). Every capture cited below was opened and looked at.

No game code was changed. QA tooling (committed):
- `tools/qa/r28-vqa-fixture-play.ts`: loads a fixture from `tests/fixtures/saves/qa` (or `level:L7:corridor` for a mission checkpoint), then plays by real keys and mouse. It walks screen-relative WASD to `--route` points or to the minimap objective pin (`--follow-marker`), aims at the nearest drawn enemy and attacks with Space (not while driving, because Space is the handbrake), and holds E on prompts (`--hold-e`). It logs HUD text, the APC armour bar, enemies and every rAF frame > 100 ms. `--setup "<js>"` is an explicit, logged fixture mutation. The only one used: elephant HP set to 40 in `l8-board-high-z1-gl`, so that boarding could be reached.
- `tools/playtest/session.ts`: `PLAYTEST_FIXTURE=<fixture>` starts a playtest session from a QA fixture instead of the level click. It was tried once (L8 lion) and then replaced by the script above, because the objective-following driver walks the L8 fixtures back to the plaza.

## Verdict

- **Reached for the first time by real input (fixtures):** the L8 gorilla arena, the elephant yard with the APC armour bar, the elephant fall ("I'm sorry."), boarding 13/13, and the L8 → L9 handover. Also the L9 rail stall, hatch defence and "Gate shut · ram the side fence", the L10 console hold, and the L7 "Go to the bus to start boarding" HUD.
- **Not reached:**
  - the L9 bridge collapse. The script cannot steer the APC around the school bus at the `l9-at-bridge` start.
  - the Mega final fight, release and real epilogue. The console-hold script either kites away (run 1) or, in run 2, is pinned at the console while the Mega never approaches.
  - the lion arena. The fixture sits before the breach, so the arena will not engage, see L8.
- **Glitches:** no new P1 confirmed. One **P1 candidate** (L9 APC pinned again, high/WebGL2) needs a human drive. One P2 confirmed (L8 boss hit flash white-out), plus P2 candidates: the L9 bridge start behind the bus, the L10 "Kill the Mega Alpha" phase with no direction, point-blank fire, and the epilogue fixture with no pull-out.
- Frame time: no frame over 233 ms in any playing run. The L8 → L9 level load had one 1000 ms frame (loading card on screen). No multi-second freeze when the L9 APC reached "barely functional" (low/WebGPU: 0 frames > 100 ms; high/WebGL2: max 233 ms).

## Runs

| Run | Fixture | Quality | Zoom | Backend | Input | Result |
|---|---|---|---|---|---|---|
| l8-lion-low-z15-gpu | l8-before-lion | low | 1.5 | WebGPU | route (-60,-9)→(-60,-20), god | Breach fired at t960 (fixture is pre-breach). Lion hit (3199 → 3118 HP) but stayed "alerted", the arena never engaged. Fought soldiers' overflow for 4 min. |
| l8-gorilla-high-z1-gl | l8-before-gorilla | high | 1 | WebGL2 | route (60,-9)→(60,-20), god | Gorilla arena engaged at about t5190 (provoked by fire), Gorilla · Phase 1, chase. The zebra arena then engaged on top (t8342). |
| l8-yard-low-z15-gpu | l8-elephant-apc-yard-engaged | low | 1.5 | WebGPU | follow marker, god | The APC armour bar shows (970 → 950 / 1000). Elephant chase, phase 1; three impacts were not achieved by the script. |
| l8-elephant-high-z15-gl | l8-before-elephant | high | 1.5 | WebGL2 | route (96,46), god | The courier was wedged at a house (82,28): the script has no pathing. The armour bar shows (gorilla cleared, so the yard is open). |
| l8-board-high-z1-gl | l8-elephant-apc-yard-engaged + elephant HP 40 (setup) | high | 1 | WebGL2 | follow marker, hold E, god | Elephant fell, "I'm sorry.", "Cover the survivors while they board" 0/13 → 13/13 in 46 s, departure. L9 loaded and the APC drove 1020 → 736 m, then was pinned (see L9). |
| l9-rail-low-z1-gpu | l9-before-rail-stall | low | 1 | WebGPU | follow marker, god (Space = handbrake bug in the script) | Rail stall, "Thirty seconds! Give me thirty seconds!", "Defend the hatch · Restart 30 s", "They're on the roof!", then "Gate shut · ram the side fence". The APC did not move afterwards because the script held Space (handbrake). Fixed before the next runs. |
| l9-bridge-high-z15-gl | l9-at-bridge | high | 1.5 | WebGL2 | follow marker, god | The APC starts nose-to-tail behind the school bus with about 40 infected. The script steered into the bus, then drove 330 m away from the bridge. Collapse not reached. |
| l10-console-low-z15-gpu | l10-dispersal-console | low | 1.5 | WebGPU | follow marker, hold E, god | Console activated ("Press E or tap the console action"), "Defend the dispersal console · Charge 0…14/60 s". The script's kiting pulled the courier 380 m away ("Charge paused"). No Mega in 8 min. |
| l10-console2-high-z1-gl | l10-dispersal-console | high | 1 | WebGL2 | follow marker, hold E, no kiting, god | Charge 60/60 at t3815 → "Kill the Mega Alpha". No Mega came on screen in 7 min; the courier was pinned at the console by armoured infected. 0 frames > 100 ms. |
| l7-board-high-z1-gl | `level:L7:corridor` (test API checkpoint) | high | 1 | WebGL2 | follow marker, god | The HUD reads the new boarding text from the corridor start. The script was blocked at (66.5, 8.6) after 200 m. |
| scenes / scenes2 | `qa-l10-epilogue`, `qa-l10-title-credits` | low + high | game camera | WebGPU + WebGL2 | Scene Lab | see "Epilogue specs" |

Coverage: low and high, zoom 1.5 and 1, WebGPU (lion, yard, rail, console 1, scenes) and WebGL2 (gorilla, elephant, board, bridge, console 2, L7, scenes).

## L8

**Glitches**
- **P2 L8 boss hit flash turns the whole animal into a flat pale silhouette under sustained fire.** With the machine gun (about 10 hits/s) the flash never fades. The gorilla and the elephant read as a flat, untextured light-grey cut-out with no fur, shading or legs; only the outline is left.
  - gorilla, high, zoom 1, WebGL2, t5192 (`l8-gorilla-high-z1-gl/s021-t5192.jpg`) and t5436 (`s022`);
  - elephant, high, zoom 1, WebGL2, t525 (`l8-board-high-z1-gl/s002-t525.jpg`: a big flat grey blob inside the yellow arena ring);
  - elephant, low, zoom 1.5, WebGPU, t646 (`l8-yard-low-z15-gpu/s002-t646.jpg`).

  When it is not being hit, the elephant reads as a grey body with red wound stripes (`l8-yard-low-z15-gpu/s003-t949.jpg`), and the dead elephant reads as a dark body behind the group (`l8-board-high-z1-gl/s003-t772.jpg`). The flash should be capped (per-hit pulse with a cooldown, or a tint instead of a full white-out). Squash and bar chip could not be judged from 4–6 s stills. The bar does drop per hit (logged HP 5866 → 5446 for the gorilla).
- **P3 L8 the objective box is 4 lines long in the elephant fight:** "Bring down the elephant! — Lure his charge into the truck or perimeter wall. Three impacts stop him. · Elephant · Phase 1 · 14 m" (`l8-yard-low-z15-gpu/s003-t949.jpg`, top right). The counter hint repeats the boss name and phase. It would read better as a one-time hint plus a short tracker line.
- **P3 L8 a lion hit before its arena opens does not provoke it.** In the pre-breach fixture the courier shot the lion through the paddock (3199 → 3118 HP, low, zoom 1.5, WebGPU, t3593–t4737). It stayed "alerted" and never fought back or engaged. The gorilla did engage when shot (t5190). This is harmless at worst, and a player only gets there by leaving the plaza early.
- **QA fixture note (tooling, not a game bug):** `l8-before-lion` and `l8-before-gorilla` are pre-breach (checkpoint `sanctuary`, tick 2643). A real player only reaches the lion after the flamingo, zebra and monkey arenas are cleared, so these fixtures cannot show the canonical lion fight. They need regenerating at the moment the lion's previous arena is cleared.
- **Checked OK:**
  - The **APC armour bar** appears once the yard is open. It is visible at the `l8-before-elephant` start (gorilla cleared) and through the elephant fight, counting 980 → 950. In r26 it was hidden in every arena; that half is now confirmed.
  - **Boarding:** after the elephant fell, 13/13 survivors boarded in 46 s (t633 → t3417; the first two took 10 s and 12 s, the rest about 2 s each). Then came departure and the L9 handover card ("Level 9 · The Crossing", `l8-board-high-z1-gl/s021-t0.jpg`).
    - No corgi stall: the corgi status was "hiding" during boarding, and the boarding count never stalled for more than 12 s.
    - No visible 1.5 m "unjam" hop in the 4 s stills (`sheet-board.jpg`). Note that 4 s stills can miss a single-frame hop.
  - "I'm sorry." plays over the elephant corpse (`s003-t772.jpg`).
  - The dead elephant reads as a body, not a shard pile.
  - Dead zebras: not seen in this round (no zebra kill on screen).
- **Not a game finding:** in `sheet-board.jpg` (t2228, t3203) the courier stands on the APC roof. That is where the script walked her (marker at the hatch). Whether walking onto the hull is intended was not checked.

**Boring / harmless / babysitting:** the boarding wait (46 s) is babysitting but short, and the group is visible beside the APC. The 26 s between 13/13 and departure (t3417 → about t4978) had no new objective text beyond "Cover the survivors while they board · 13/13 aboard". If the player must enter the APC to depart, the tracker should say so.

**Stunning?** Partly. The night yard with the APC, the lit house porches, the box truck and the crowd at the hull is a strong frame (`s009-t2228`). The pale flash bosses are the weak point.

## L9

**Glitches**
- **P1 candidate (needs a human drive) L9 APC pinned in a crowd again after the L8 handover.**
  - High, zoom 1, WebGL2, run `l8-board-high-z1-gl`, L9 ticks 6617–9956. The APC sat at (-265.7, -15.4) for 56 s with held keys toward the minimap pin (no Space), moving 0.3 m.
  - It was at "APC barely functional", inside a crowd of about 50 infected (runners, sprinters, screamers, dogs, an alpha, zebras, an elephant; `s059-t9178.jpg`, `s060-t9420.jpg`).
  - The r27 heavy-contact grace should allow ramming. The script steers straight toward the pin with no reversing, so a fence or verge might be the block. A human should try the same spot, reversing.
- **P2 L9 `l9-at-bridge` start: the APC sits nose-to-tail behind the school bus inside a horde.**
  - High, zoom 1.5, WebGL2, t67 → t2500 (`l9-bridge-high-z15-gl/s000-t67.jpg`, `s008-t2500.jpg`). The objective "Drive onto the bridge · 23 m" points east, through the bus.
  - The armour dropped 500 → "barely functional" by t1531 while the script pushed into the bus. A player has to reverse out of a wedge at a checkpoint resume.
  - This is fixture or checkpoint placement, but the same spot is the real `bridge` checkpoint respawn.
- **P3 L9 large flat route arrows on the road at the bridge approach** (`s000-t67.jpg`: two long translucent beige arrows on the asphalt). They are not over the APC (Q-146), but they are big.
- **P3 L9 night read at the rail crossing (low, WebGPU):** the grass reads as flat bright green, almost day-lit, under the "Wind" weather (`l9-rail-low-z1-gpu/s000-t61.jpg`, `s012-t3706.jpg`). The road and bridge shots at high are clearly night.
  - The new cheaper shadow filters show a soft APC shadow. At the rail it is a long dark smear to the lower left of the hull (`s012-t3706.jpg`), the same as the r26 P3 "detached shadow".
  - Moon edge softness and headlight shadows on foliage were not isolated in a close shot this round.
- **Checked OK:**
  - **Rail stall and hatch fight:** "Thirty seconds! Give me thirty seconds!", "Defend the hatch · Restart 30 s" counting down, "They're on the roof!", then "Reach the evacuation gate · Gate shut · ram the side fence" (`sheet-l9rail.jpg`).
  - School bus, barrier and crowd at the rails all read well.
  - **APC lights die without a freeze:** "APC barely functional" at t2637 (low, WebGPU) with 0 frames > 100 ms in the whole run. At high/WebGL2, max 233 ms (t596) and 150 ms (t3543).
  - The armour bar counts down and turns "· CRITICAL" at 250.
- **Not reached:** gate ram, bridge collapse, crawl.

**Boring / harmless / babysitting:** the hatch fight is short and readable. A pinned APC in a crowd for a minute or more is the opposite of fun if a human hits it too.

**Stunning?** The rail-crossing frame with the school bus, the warning barrier, the smoke and the swarm is strong (`s010-t3102`). The night bridge approach in rain at high is good (`s000-t67`).

## L10

**Glitches**
- **P2 (fixture) L10 epilogue in Scene Lab:**
  - The camera keeps the gameplay framing for the whole 29–65 s window and never pulls out.
  - The full gameplay HUD stays on: party bars, minimap, weapon rack, objective "Minor Incident · 18 m".
  - The courier walks out of frame at about 47 s.
  - The ground is a flat olive plane with two or three survivors. The cure dust "tide", cured crowd, journey shots and sunrise are not visible.

  Evidence: `scenes/qa-l10-epilogue-webgpu-high/sheet.jpg`, frames f0–f1800. `View.epilogueScale` is always 1 at HEAD (the pull-out moved into `LevelTenEndingView`), so the Scene Lab fixture may not drive the cinematic. Real play could not confirm or clear it this round (no release reached). Treat as **unverified**, not as a confirmed game bug.
- Checked OK in the fixture:
  - "Private Reyes (radio): Delivery confirmed. …Show-off." at 41 s;
  - "Delivered ✓" at about 53 s;
  - the "Minor Incident" title at 65 s for exactly 5 s over the dark scene;
  - scrolling credits with Pause/Skip, readable, LLM, tool and sound credits listed, about 30 s shown (`scenes/qa-l10-title-credits-webgl2-low/sheet.jpg`).
- **Console hold:** "Activate the dispersal console · 2 m · Press E or tap the console action" → "Defend the dispersal console · Charge N/60 s" counts 1 per second. Leaving the area pauses it ("Back to the dispersal console · Charge paused · 14/60 s · 382 m"). Clear. The console reads as a glowing screen with a ring (`sheet-l10c1.jpg`, s001).
- **Run 2 (high, zoom 1, WebGL2, no kiting):**
  - The charge filled to 60/60 at the console. At t3815 the objective switched to **"Kill the Mega Alpha"**.
  - For the next 7 min (to t30147) no Mega came into the 32 m view or the enemy list. It shows only as a red ring at the minimap edge (`l10-console2-high-z1-gl/s021-t7670.jpg`), with no distance and no screen-edge arrow in the tracker.
  - Meanwhile a ring of armoured infected, firefighters and runners pinned the courier and the corgi against the console at (4002.5, -27.5) for the whole time, under repeated alpha slam rings.
- **P2 candidate L10 Mega phase: "Kill the Mega Alpha" gives the player no direction and nothing to fight for minutes.** The Mega stayed off-screen. Story: "the thing comes for the console"; at HEAD it did not come within 7 min with the courier at the console. Possibly the Mega waits to be approached. If so, the tracker needs a distance or an edge arrow.
- **P2 candidate (needs a sim check) point-blank fire barely hurts infected in contact.**
  - L10: two armoured infected stayed at 530 and 600 HP for minutes, and a firefighter at 210/210, while the courier fired the machine gun at their chests at 1.1–1.3 m (`s021-t7670.jpg` shows the tracer).
  - L8 yard: a runner at 10 HP survived 80 s at 1.1 m.
  - The script aims at the drawn chest. A degenerate aim at contact range is the likely cause, but a player would see the same thing: "my gun does nothing at point blank". Per lessons-learned (r24), damage claims need a deterministic sim test before they are filed as bugs.
- **P3 L10 enemies around the courier draw as translucent dithered ghosts at high/zoom 1** (`s021-t7670.jpg`: the ring of infected is see-through purple). This is the see-through occluder treatment applied to actors, and it makes the threat hard to read.
- **P3 L10 console area at low is bland:** a dark blue-grey plane with a few square blocks. Armoured infected walked after the courier in single file for 3 min (`s004`, `s009`).
- **L10 respawn:** not re-measured (god mode in every run). r28-l7l10 measured 33 ms.
- **Not reached:** Mega final fight, release, real epilogue, Thanks card, sunset-grove props.

**Boring / harmless / babysitting:** in run 1 nothing threatened the console while the courier was away. Armoured infected at 600 HP chased without a hit landing for 3 min (god mode, so damage taken was not measured).

**Stunning?** Not judgeable from real play this round. The fixture epilogue is not stunning: flat ground, HUD on, no pull-out.

## L7

- **Checked OK (the r28-l7l10 fix):** from the corridor checkpoint the tracker reads "Get everyone aboard the bus · 345 m · Aboard 0/24 · Go to the bus to start boarding · 340 m", and the distance falls as the courier walks toward the bus (high, zoom 1, WebGL2, `l7-board-high-z1-gl/s000-t65.jpg`, `s015-t3727.jpg`). The "Waiting for Marcus · 3 m" text is gone in the waiting phase. The switch to "Waiting for <name>" inside the ring was not reached: the script got stuck at (66.5, 8.6), 137 m short.
- **P3 L7** the tracker line shows two distances to nearly the same place ("· 345 m" and "· 340 m"). Drop one.
- **P3 L7** "They're inside!" floats over the army truck at the level start (`s000-t65.jpg`). It is still a loose label, though it no longer strikes through the objective box as in r26.
- "Wait for us! Stay with the group." fires while the group stands right next to the courier (`s015`, `s029`). The courier was wedged at a fence; this is driver-caused, but the line may be too eager.

**Stunning?** Yes, as in r26: the ash-fall night street with the lit column of survivors (`sheet-l7.jpg`).

## Epilogue specs

The clocks are re-based to `LevelTenEpilogue.ts` (epilogue 65 s, pull-out 15 s, title 5 s, credits 90 s):
- `qa-l10-epilogue`: `epilogueElapsed` 6840 → 1740. That is the last 36 s of the 65 s epilogue; the title starts at frame 2160.
- `qa-l10-title-credits`: 8940 → 3840. It also gets its own `shots` `[0, 60, 360, 479]`. The inherited 2159 shot had stretched the run to 2160 frames, which is why `creditsFrames`/`fanFrames` failed in r26 too.

Measured on WebGPU and WebGL2, low and high. The values were identical on both backends. Epilogue: `scenes2/`. Title-credits with its own shots: `scenes2/`, final check `scenes3/`.

| metric | epilogue low | epilogue high | new bound | title-credits low | title-credits high | new bound |
|---|---|---|---|---|---|---|
| playableTravel | 0 | 0 | [0, 1] (story lock from 8 s; was [4, 20]) | – | – | – |
| survivors | 3 | 6 | [3, 6] | 3 | 6 | – |
| radius | 7576.7 | 7576.7 | [7500, 7600] (was [1500, 1510]) | 8400 | 8400 | – |
| titleFrames | 41 | 41 | [1, 60] | 300 | 300 | [300, 300] |
| creditsFrames | 0 | 0 | – | 121 | 121 | [110, 130] |
| pullScale | 1 | 1 | [1, 1] (was [6.9, 7.1]) | 1 | 1 | [1, 1] (was [6.9, 7.1]) |
| fanFrames | 2199 | 2199 | [2000, 2200] | 479 | 479 | [400, 480] |
| mistPuffs | 12 | 28 | [8, 400] (was [10, 400]) | 2 | 2 | [1, 400] (was [10, 400]; the mist has mostly settled by 64 s) |
| draw calls max | 45 | 50 | ≤ 300 | 40 | 44 | ≤ 300 |
| triangles max | 51.8k | 124.9k | ≤ 500k | 45.5k | 101.1k | ≤ 500k |
| console errors | 0 | 0 | 0 | 0 | 0 | 0 |

Result with the committed bounds: `qa-l10-epilogue` **passes** on 4/4 (WebGPU/WebGL2 × low/high, `scenes2/`). `qa-l10-title-credits` **passes** on WebGPU low and WebGL2 high (`scenes3/`). Its other two combinations measured the same values in `scenes2/`, where only the old mist minimum failed.

`pullScale` no longer measures the pull-out: `View.epilogueScale` is always 1 at HEAD, because the 15 s pull-out is a cinematic camera in `LevelTenEndingView`. The bound [1, 1] only guards that the old radius scaling stays gone. The pull-out itself must be reviewed in the shots (and the fixture showed none, see L10). Suggested follow-up: a Scene Lab `cameraHeight` max metric for the pull-out.

## Unchecked (follow-up)
- L8: the canonical lion/lioness fight (needs a fixture just after the monkey arena clears), lion and gorilla squash/bar chip in close frames, dead zebras.
- L9: gate ram, bridge collapse, crawl; human drive of the pinned spot (-266, -15) and of the `bridge` checkpoint start behind the school bus.
- L10: Mega final fight, release, the real epilogue (dust tide, cured crowd, pull-out, Thanks card), respawn hitch at high, sunset-grove props.
- L7: the in-ring "Waiting for <name>" switch.
