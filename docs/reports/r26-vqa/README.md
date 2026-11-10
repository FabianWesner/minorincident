# r26-vqa: Opus visual and gameplay QA of L7–L10 on batch 60 (main 1938e59a)

Lane r26-vqa (claude-opus-5-5). It used a local `npm run build:qa` of 1938e59a (dist tree 6b916feb) with the real-input playtest driver (`tools/playtest/play.ts`). Runs were headless, with one browser at a time through `tools/e2e-lock.sh` and ports 4891/4892. On 2026-11-10, 07:48–09:30 CET. Raw captures and logs are in the QA scratchpad `/private/tmp/claude-501/-Users-wesner-Workspace-minorincident/80ad2360-311d-4d06-a844-c0ced149d4ee/scratchpad/r26-vqa/<run>/` (not in git). Run summaries are in [summary.json](summary.json). One sheet per level: [sheet-l7.jpg](sheet-l7.jpg), [sheet-l8.jpg](sheet-l8.jpg), [sheet-l9.jpg](sheet-l9.jpg), [sheet-l10.jpg](sheet-l10.jpg).

No game code was changed. One QA-tool fix was committed (`484883d0`, see "Tooling").

## Verdict

Batch 60 on PROD is **not clean for L8–L10**. None of L8, L9 or L10 could be finished by real input in this round. Two findings look like real game problems, not bot problems:
- **P1 L9:** an infected crowd pins the APC. Held keys move it ≤ 3 m in 3 s, so the drive stalls for minutes.
- **P1 L9:** 2–6 s freezes when the first boarder wave hits. Reproduced 3×, on WebGPU and WebGL2.

The visual P2s:
- dead zebras render as shard piles;
- tree canopy hides the monkey arena;
- the L9 APC hull reads as an outline under smoke at the floor stage;
- the L10 farmhouse cutaway is a black void;
- 267–383 ms respawn frames in L10;
- the L7 boarding stall on "Waiting for Marcus · 3 m".

The r25 L8 cue fixes (rest cue, plaza marker, armour bar hidden in the arenas) **pass**.

## Runs

| Run | Level | Quality | Zoom | Backend | Entry | Result |
|---|---|---|---|---|---|---|
| l8-low-z15-gpu | L8 | low | 1.5 | WebGPU | debug (fresh), no god | 595 s browser cap. It went through sanctuary, protect, flamingo and zebra (3 deaths), then about 10 deaths in the monkey arena. Not finished. |
| l8-high-z1-gl-god | L8 | high | 1 | WebGL2 | debug, god mode | Reached the lion arena (t23084) within its 480 s session. Segment 2 restarted the level from the beginning: L8 has no mid-level resume (only L10 has `cureResume`). Stopped. |
| l10-low-z15-gpu | L10 | low | 1.5 | WebGPU | debug | The driver steered to the step anchor 1 km east, not to the HUD route. It died 7× in the corn corner at (815, −11) and could not finish "farmstead" in 8.5 min. |
| l10-high-z1-gl-visible | L10 | high | 1 | WebGL2 | debug, `PLAYTEST_VISIBLE_ONLY=1` (follows the minimap pin) | It went through the river and town onto the farm route, then died repeatedly in the corn/farmhouse hide gap at (883, 14). "farmstead" was not finished in 8.5 min. |
| l9-low-z1-gl-road | L9 | low | 1 | WebGL2 | debug, `--l9-route road`, old driver | Stopped early. It was used for the manual-key tests that found the driver bug. |
| l9-high-z15-gpu | L9 | high | 1.5 | WebGPU | debug | The driver used tank controls (bug, fixed in `484883d0`). The APC drove away from the evac point, was swarmed and wedged in a paddock. |
| l9-low-z1-gl-fix2 | L9 | low | 1 | WebGL2 | debug, `--l9-route road`, fixed driver | The APC drove the road route correctly for 60 s (1020 → 863 m). Then a crowd pinned it at (−325, −334) for 7 min (863 → 819 m). Manual held keys could not free it. |
| l7-high-z1-gl | L7 | high | 1 | WebGL2 | debug | 17 deaths. The group fell from 24 to 13. Boarding stalled on "Waiting for Marcus · 3 m" for about 3 min, and the driver cap skipped departure. |
| scene-l8late | L8 | low | — | WebGPU | Scene Lab `qa-late-lion-pounce`, `qa-late-gorilla-pound`, `qa-late-elephant-charge` | 3/3 gates pass. |
| scene-epilogue, scene-epi-full | L10 | low / high | — | WebGPU / WebGL2 | Scene Lab `l10-d4-epilogue`, `qa-l10-epilogue`, `qa-l10-title-credits`, `ui-menu-credits`, plus a scratch copy of `qa-l10-epilogue` from release (`epilogueElapsed: 0`, 4500 frames) | 2/4 catalog specs pass. The two epilogue specs fail on gates written for the old 150 s epilogue (see L10). |

High+low, zoom 1.5+1 and WebGPU+WebGL2 are covered per level as listed. Every capture cited below was opened and looked at.

## L7

**Glitches**
- **P2 L7 boarding stall (babysitting).**
  - At t18922–t30395 (about 3 min), the objective read "Get everyone aboard the bus · 38 m · Aboard 0/13 · Waiting for Marcus · 3 m" while all 13 survivors stood in a neat queue beside the courier. Nobody boarded, and the courier was under constant attack by the horde behind the concrete barrier.
  - The driver did not walk to the bus ring 38 m away. That is a driver gap, but the HUD "waiting for Marcus · 3 m" while Marcus stands 3 m away and the queue does not move is confusing for a player too.
  - Evidence: high, zoom 1, WebGL2, `l7-high-z1-gl/captures/continue-L7-L7-t29769.jpg`.
- **P2 L7 attrition / difficulty at high.**
  - 17 courier deaths and group 24 → 13 before the bus. The courier yo-yoed between the checkpoint (x≈265) and x≈190 for about 4 min (deaths at t1064–t14018).
  - vqa60 had 24/24 boarded at low/WebGPU. High tier at zoom 1 is much harder for the same driver, so this needs a PO feel call: bot skill vs. tier difficulty.
  - Evidence: `continue-L7-L7-t610.jpg` (35 HP inside a red slam ring, horde on the group) and the result card `continue-L7-L7-result.jpg` (Deaths 17, Kills 316).
- **P3 HUD overlap at level start.** The orange "They're inside!" label is drawn across the bottom border of the objective box, so it reads as struck through (t3, `continue-L7-L7-t3.jpg`).
- Checked OK:
  - Rifle soldiers (camo, helmets, packs) walk inside the group and hold their rifles (t610, t3664).
  - The Alpha worker reads as a hulking grey brute with red eyes and blood, at its LOD at zoom 1 (t610, t7303).
  - The Alpha slam telegraph is a red ground ring (Q-147 OK).
  - The healing pickup worked (HP 35 → 63 → 90 between t610 and t7303), but no frame catches the medkit model itself. The medkit look is still **unchecked**.

**Boring / harmless / babysitting:** not harmless (316 kills, 2107 damage taken). It is not boring: rocket blasts, fires and a 24-person column under ash fall. The one babysitting moment is the Marcus boarding wait above.

**Stunning?** Yes. The ash-fall night, the burning barricades and the lit crowd column are the strongest frames of the round (sheet-l7). Missing: the end/boarding moment loses its drama when the queue just stands.

## L8

**Glitches**
- **P2 L8 animal corpses render as shard piles.**
  - Dead zebras turn into a crumpled heap of striped triangles. The silhouette is not readable as an animal; it looks like broken geometry.
  - Seen in every run once the zebras fall: low, zoom 1.5, WebGPU, t23640 / t24620 (`l8-low-z15-gpu/captures/continue-L8-L8-t23640.jpg`, `…-24620-stuck-at-ring.jpg`), and the two corpses in the foreground of `…-t26687.jpg`.
  - Dead flamingos read fine (a pink body on its side).
  - Same family as P1-117 / Q-124 (corpses must read as bodies).
- **P2 L8 monkey arena under the tree canopy.**
  - The monkeys and the survivor group are hidden under opaque tree crowns. Only floating health bars show where they are, while the courier is being killed.
  - Evidence: low, zoom 1.5, WebGPU, t27911 (`…-t27911.jpg`: three red enemy bars over a canopy with no visible bodies, survivor pips over the right-hand canopy).
  - At night the grey-black monkeys on dark grass are also hard to read at high/zoom 1 (`l8-high-z1-gl-god/captures/campaign-L8-t21818.jpg`).
- **P2 L8 difficulty: zebra and monkey arenas kill the courier in a loop, and arena HP resets.**
  - Zebra: 3 deaths (four zebras of 1250 HP each, 0.6× damage outside exposed windows). Monkey pack: about 10 deaths in 2.5 min. Grabs take the courier from 100 to 0 HP in about 4 s (t27681–t28138), and the pack is back near full HP after each respawn.
  - The driver does not melee out of a grab ("Melee shakes off a grab"), so this is partly bot skill. It still needs a PO feel check of the monkey grab damage. Not reproduced by a human.
- **P3 L8 flamingo "boss" is over before it starts.**
  - The flock is mostly killed by the courier and the soldiers during the 30 s "Protect the group!" window. At low/1.5, "Defeat Flamingo flock" was on screen for about 4 s (t5400 → t5622) before switching to zebras.
  - At high/1 with god mode it lasted to about t11800, so this varies.
- **P3 L8 zebra phase 2 with nothing to fight.** About 45 s at "Zebra herd · Phase 2 · 0 m" with no living zebra in view or in the driver's enemy list (t24620 → t27422). The arena then hands over to monkeys.
- **P3 L8 story text placement.**
  - At the breach Hale says "Tunnels! Get the civilians to the plaza!" while everyone already stands in the plaza ring (`…-t3652.jpg`).
  - The subtitle box covers the group at zoom 1.5 (`…-t1221.jpg`).
  - "Protect the group! · 0 m" shows a redundant "· 0 m".
- **P3 L8 group under trees on the walk-in.** Survivor pips float over canopy with no bodies visible (`…-t615.jpg`). Inherited style, same root cause as the monkey arena.
- Checked OK (r25 fixes):
  - The **sanctuary rest cue** works. At t971 inside the ring the tracker reads "Rest at the plaza with the group" with no distance, until the breach at t3601 (`…-t2441.jpg`). Same at high (t966).
  - The **"Protect the group!" plaza marker** is drawn from the first breach frame (yellow ring + pin on the plaza, `…-t3652.jpg`, `…-t4861.jpg`).
  - The **APC armour bar** was hidden in every arena frame (flamingo, zebra, monkey, lion intro). The yard was not reached, so the "shows once the yard opens" half is **unchecked**.
  - **Bosses react and show bars:**
    - Flamingo, zebra and monkey health bars drop under fire.
    - In Scene Lab, lion (pounce lane telegraph), gorilla (pound ring) and elephant (charge lane, crash into the car) show telegraphs and health bars.
    - Fixture note: the elephant mesh overlaps the red car during the crash frames f75–f180 (P3).
- Not reached in real play: lion/lioness and gorilla arenas (god run reached the lion intro only), the elephant + APC yard and boarding. Reason: the 10-min browser reservation, plus L8 has no mid-level resume. This needs either a checkpoint save tool for L8 or a longer quiet-window session.

**Boring / harmless / babysitting:**
- Boring: about 45 s of "Rest at the plaza" with nothing to do (intended calm beat, now explained by the cue). Also the 45 s empty zebra phase 2.
- Not harmless: the monkeys are the opposite, a death loop.

**Stunning?** Partly.
- Good: the lit night zoo, the plaza fight with soldiers, the corpse field at high (`campaign-L8-t10898.jpg`) and zebras charging along the fence.
- Missing: the animal corpses (shard piles) and the canopy hiding the arena fights.

## L9

**Glitches**
- **P1 L9 APC pinned by infected; the level stalls.**
  - With the fixed driver on the road route (low, zoom 1, WebGL2), the APC reached (−325, −334) at about 60 s. Then a pile of 4–15 infected at its front bumper held it for the rest of the session: 863 → 819 m in 7 min.
  - Held keys from the control file (real input, driver paused) were S 3 s: 3.4 m; A 3 s: 0.8 m.
  - The APC was at the durability floor ("APC barely functional"). Per `apcFloor.speedShare` it should still do 60 % speed.
  - The WebGPU high run (with the old driver) also ended pinned by a crowd in a paddock.
  - Evidence: `l9-low-z1-gl-fix2/captures/continue-L9-L9-3686-stuck-navigating.jpg`, `…-manual-KeyA.jpg`, `…-30125-cannot-finish.jpg` (a stack of infected in front of the hull).
- **P1 L9 multi-second freezes when the first boarder wave hits.** It reproduced in three runs, on two backends and two tiers, each time at the first big swarm on the APC as "Shake off boarders" starts:
  - 517 ms + **5250 ms** + 217–467 ms (high/1.5/WebGPU, t3927–t4134);
  - **6100 ms** + 283 + 4× 700 ms (low/1/WebGL2, t4774–t5017, during the manual-key test with 29 infected around the APC);
  - **1967** + 967 + 800 + 800 + 783 ms (low/1/WebGL2, t3765–t4009).
- **P2 L9 APC hull reads as an outline.** Under the damage smoke at the floor stage the hull goes see-through/dark: you see wheels, the frame outline and the infected through it (`…-manual-KeyA.jpg`, low, zoom 1, WebGL2). The playbook makes visible defects on a vehicle the player uses P1; it may be the intended crew cutaway plus heavy smoke, so it needs a look.
- **P2 L9 APC drives along and through a fence line off-road** (old-driver run, high/1.5/WebGPU, t6802, `l9-high-z15-gpu/captures/continue-L9-L9-t6802.jpg`). The fence rails pass through the hull's left side. Q-139 (no off-road wedge) also failed in that run: the APC ended in a fenced paddock corner (t10683). Both came from the bot driving off-road with wrong controls, but they show it is possible.
- **P3** The APC shadow lies detached about 6 m to the lower left under the low light (`…-30125-cannot-finish.jpg`).
- Checked OK:
  - APC model, headlights and the opening line "Bridge is forty klicks…".
  - "They're on the roof!" fires with real boarders on the hull.
  - The "Shake off boarders" prompt.
  - The APC armour bar counts down (1000 → 930 → 280 → "barely functional").
- Not reached: the school bus, rail stall, gate, bridge collapse and crawl. The APC never got past about 860 m.

**Boring / harmless / babysitting:** the first 60 s of driving are good. After that, the "Shake off boarders" fight is a stuck APC in a crowd, for minutes.

**Stunning?** The night road with headlights and rain reads well (sheet-l9). Nothing stunning was reachable this round.

## L10

**Glitches**
- **P2 L10 respawn hitch.** Every respawn at (740, −10.7) produced one frame of 267–283 ms (7 respawns, low, zoom 1.5, WebGPU; `l10-low-z15-gpu`, ticks 7616, 9949, 11996, 14346, 16645, 18928, …). This is over the 200 ms rule.
- **P2 L10 farm guidance.**
  - The objective "Find a way through the farms" points a screen-edge arrow and the minimap pin back west/south-west to the route waypoint (698, 25), while the step anchor is 1 km east (1857, 25).
  - The old driver followed the anchor into an eastern corn corner and died there 7×.
  - A human sees the arrow, so this is mainly a driver issue. The arrow pointing "back" right after "Get away from the river" is still worth a look (`continue-L10-L10-t3109.jpg`: arrow at the left screen edge, "52 m").
- **Visible-only run** (high, zoom 1, WebGL2; the driver follows the minimap pin like a player):
  - The route pins (647,−12 → 698,25 → 940,−12) lead through the town street and then into the gap between the corn and a farmhouse.
  - The courier died there over and over at (883, 14) from t17000 to the cap (HP 0 at t17210, t25306, t34635 …). The driver cap fired at t30175 on "farmstead".
  - Respawn frames at high are **367–383 ms** (8 respawns at (847, 25)), the same P2 as above.
  - The "hide gap" ("It can't fit where you fit") is where she dies: two or three infected follow her into it, and a large brute waits at the corn edge (`l10-high-z1-gl-visible/captures/continue-L10-L10-t24981.jpg`).
- **P2 L10 farmhouse cutaway reads as a black void.** At the hide gap the farmhouse roof is cut away, and the inside is a flat black box with loose window frames lying in it, next to the courier (high, zoom 1, WebGL2, `…-t24981.jpg`, `…-step-restricted-zone.jpg`). She seems to walk on a white wall rim beside a black hole.
- The **town street** before the farms looks good: lit street lamp, mailboxes, fences, and a brute with red eyes stalking on the road (`…-t6977.jpg`).
- Farms look:
  - Flat grey ground with sparse dead trees and dark corn blocks (`…-t1245.jpg`, `…-t3109.jpg`). Readable but bland at low.
  - Infected attacking from inside the corn are dithered purple shapes (`…-t9221.jpg`).
  - A tall shaggy figure stands at the corn edge in several frames (Mega sighting/scare), well framed.
- **Epilogue (Scene Lab fixture only, not real play):**
  - From release, the radio lines run in order: Rosa (30 s, `L10.epilogue-rosa`), "Private Reyes (radio): Delivery confirmed. …Show-off." (37 s), then **"Delivered ✓"** at 50 s (`scene-epi-full/shot-3000.png`). Then the **"Minor Incident"** title and **scrolling credits**: readable, with Pause/Skip buttons, LLM and sound credits listed (`shot-4499.png`, `scene-epilogue/qa-l10-epilogue/sheet.jpg`).
  - **Not verified:**
    - the green cure dust tide, cured crowd and kneel-to-stand;
    - the zoom-out over the whole level (fixture `pullScale` stayed 1);
    - the courier on the steps with the corgi.
  - The fixture camera framed empty ground (the courier is out of frame at 50 s). It also showed a doubled minimap and "Corgi · awaiting rescue" plus five party bars. These look like fixture artefacts (Scene Lab HUD), not confirmed game bugs.
  - **P2 (QA tooling):**
    - `qa-l10-epilogue` and `qa-l10-title-credits` fail on 6 + 4 gates written for the old 150 s epilogue (radius ≤ 1510, pullScale ≥ 6.9, titleFrames ≤ 60, creditsFrames ≤ 130). They need re-baselining to the 65 s epilogue before they can guard it.
    - The tracked L10 corridor save `docs/reports/sweep-c5/L10-05/seeds/L10-05-high-cure-corridor-save.json.gz` no longer decodes at HEAD (`decodeSave` status ≠ ok). The real-input console → Mega → epilogue path therefore cannot be started from a checkpoint, and it was **not checked** this round.
- **Sunset-grove prop hits: not checked.** No run reached the sunset-grove district (r22: about 74 s in at the farm crossing on the old route). See the visible-only run.

**Boring / harmless / babysitting:** the farm stretch is dark-grey and empty between corn blocks (inherited, vqa60). It is not harmless: deaths in the corn.

**Stunning?** Not yet at the farms. The ground is a flat grey plane under the dead sky. The epilogue text beats exist, but this round could not show the visual payoff (dust tide, cured people, zoom-out).

## Tooling

- `484883d0` fix(playtest): the L9 driver now steers with screen-relative WASD.
  - Since keyboard driving became screen-relative (`src/sim/vehicles/Vehicles.ts`: "Keyboard vehicle directions match walking"), the driver's W + A/D tank controls drove the APC backwards or off-road. Before the fix: −550 → −566 x backwards in 20 s. After: −550 → −351 along the road route in 33 s.
  - eslint is clean on the file; it was not type-checked separately.
- Tried and reverted (not committed):
  - A scratch copy of `vqa60-run.ts` that allowed a permitted Mega skip. It never ran because the tracked save does not decode.
  - A `killAll` control command to fast-forward the L8 arenas inside one reservation. Killing the pre-spawned arena animals with the `cheats.killAll` health write left the zebra arena waiting forever (run `l8-low-z1-gpu-ffwd`, "hidden-condition" at t16036). That came from the cheat, not the game. Do not use `killAll` to skip L8 arenas.
- The L10 driver uses the step anchor rather than the visible pin unless `PLAYTEST_VISIBLE_ONLY=1`. With the anchor it walks into dead ends on the L10 farms.
- L8 cannot be covered end to end inside the 10-min browser reservation: no mid-level save, and arenas take 2–4 min each for the bot. Use a checkpoint/arena fixture or a quiet-window long session.

## Unchecked (needs a follow-up)
- L7: medkit model close-up; zoom 1.5 at high and WebGPU at high.
- L8: lion/lioness and gorilla in real play, the elephant + APC yard, the APC armour bar appearing at the yard, and boarding.
- L9: school bus, rail stall, gate, bridge collapse, crawl.
- L10: sunset-grove prop hits, console hold, Mega fight, and the real epilogue (dust, cured crowd, zoom-out, credits after a real win).
