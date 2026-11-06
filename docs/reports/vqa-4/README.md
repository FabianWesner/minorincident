# vqa-4: Opus visual QA of L6–L10 before deploy (plus L2/L3 fix re-check)

Main `878c2ce` (after `lane/vqa-fix-6`). QA build (`npm run build:qa`), 2026-11-06 12:00–13:10 CET. This report lists findings only. No game code was changed.

**Tooling**
- `tools/qa/vqa-4-run.ts`: a copy of `vqa-3-run.ts` with output under `test-results/vqa-4/`. Two additions:
  - `keep` moves the saved local storage to the new preview origin, so a run can resume from the previous run's profile;
  - `VQA_LEVEL_MINUTES` overrides the 9-minute level cap.
- The `tracked` L10 source no longer works: commit `40f3d1de9` is gone after the history squash. Instead, L10 ran as a chain on one profile:
  - preset (start to the research checkpoint);
  - then `keep` to the console hold;
  - then `keep` to the credits.
- Real input ran unpaused through the shared browser pool on 4329, with at most two contexts at once and a private preview port per run. God mode was on for the courier only, with `PLAYTEST_REVEAL_AUDIT=1`.
- Each run took per-step photos at low/high × zoom 1.5/0.5, plus an unpaused frame every 5 s (every 2–3 s for the L10 finale).
- **Framing note:** in these captures, `z0-5` is the close framing and `z1-5` the wide one.
- I looked at every capture this report uses, at full size or as a crop wherever a finding depends on it.
- Evidence sheets are in `test-results/vqa-4/evidence/` (git-ignored, on the lane's disk only).

## Verdict

**No P1 found on the player, the companion or a vehicle the player uses.** Nothing I saw is a new P1 that blocks an interim deploy under the PO 11-03 rule. The strict rule ("every row PASS, no P1/P2 open") is not met, because of the P2s below.

The two findings to weigh before a deploy:
1. **#1, L10 corpse shards.** Through the whole hold, the Mega fight and the 150 s epilogue, the apron corpse field reads as flat red/navy triangle shards, not bodies. This fails PO checklist line P1-117 ("Corpses look like bodies up close") on L10, on both backends. I could not A/B it against PROD.
2. **#2, the L7 continue-save opening.** Infected reach the courier 1.4 s after level start. The launcher 3 m away stays out of reach for 117 s, and the god-mode courier is "killed" and restarts. The fresh run had no contact at all.

The L2/L3 fixes from vqa-fix-6 all landed:
- no fire-engine hull hole;
- no ramp ghost;
- worn arrows;
- capped bars;
- lighter smoke.

| Level | Glitches | Stunning? | Boring / harmless / babysitting |
|---|---|---|---|
| L6 | P2: in the fresh run the driver stalled 150 s at the `gate-90` gate grille, with two 600-HP riot cops on the courier (#5).<br>P3s:<br>• the alarm stays on for the whole retreat (#9)<br>• the "Into the tunnel!" bubble is cut at the top edge<br>• a hard-edged night light disc at the exit (#14) | The shelter lamps, the tunnel rails and the riot cops at close zoom read well. At wide zoom the tunnel is a dark slab with orange strips. | **Babysitting:** the preset (MG, god mode) finished with "Group at start 29, lost or turned 28". "Survivor under attack! Turn back!" is on screen almost without a break from the retreat start to the exit, so it stops meaning anything. |
| L7 | **P2 #2:** the opening mob on a continue save.<br>P2 #3: the point-blank rocket fireball is an opaque orange torus with a hard hole around the courier.<br>P3s:<br>• the launcher ring is buried under survivors (#13)<br>• red chevron paint on the bus road (#15)<br>• "Aboard 0/0 · Everyone aboard" when nobody is left (#4) | Yes. The ash-fall night, the fires, the horde at the truck and the long survivor column at zoom 1.5 look great. The end shot shows the bus and red haze, with no map edge. | **Babysitting:** the group bled out during boarding in both runs:<br>• fresh: 24 → 0 aboard, ending "Aboard 0/0 · Everyone aboard";<br>• preset: 23 → 18 while "Waiting for a survivor · 3 m".<br>The off-screen alarm ("Survivor lost behind you!") fires as designed (#4). |
| L8 | P3s:<br>• survivors clip into the courier at the bus (#16)<br>• the courier is drawn over a bare tree in front of the camera (#16)<br>• the male courier runs with the launcher pointed at the ground (#17) | The lit zoo walls, the watchtowers, the yellow generator and the APC under floodlight are good. The zoo calm phase (fresh run) is short and dark. | Not harmless. The breach horde reaches the APC, and armour drops 1000 → 820. |
| L9 | P3s:<br>• blood on the APC hull is flat red ovals (#18)<br>• stepped shadow-map edge under the APC (#18) | The bridge collapse reads well: the APC falls whole into the gap and the courier crawls out. The countryside drive is a dark, featureless purple plane. | **Harmless/boring (P2 #6):** about 90 s of driving with almost no contact. Armour went 1000 → 980 (preset) and 1000 → 970 (fresh). The quiet-interval patrols were only one or two infected each time. |
| L10 | **P2 #1:** corpse shards.<br>P3: the Mega fight is over in about 15 s with the rocket launcher (#11). | **The finale is a spectacle:**<br>• an assault ring of 60+ infected around the console<br>• rocket blasts<br>• the Mega readable as a horned pale brute with a red eye<br>• the credits over the aerial shot<br>The 8-minute overland walk is empty dark grass. | **Boring/harmless (P2 #7):**<br>• about 8 min of walking with a single infected now and then;<br>• the destroyed corridor and the dispersal approach have 0 infected near the courier for about 2.5 min (t5023–t15191 of the resumed run), so I saw no corridor patrol. |

## Requested re-checks

### L2 and L3 (vqa-fix-6)

- **L2, courier on foot behind the parked fire engine:**
  - There is no hull hole. The engine is intact in every doors-phase frame (WebGPU high/low, both zooms: t2982, t3016, t3316, t3656). She shows as a translucent gold x-ray figure over the engine.
  - **Does it read well?** Only partly. Her feet land on the engine's roof line next to the ladder (t3016, t3656), so at a glance she reads as **standing on the roof** of the engine, not behind it. This is a big improvement over the P1 hole and not a defect, but a ground cue would help (her ring or shadow drawn through the hull, or the contour clipped at the hull's top edge) (#8).
  - Evidence: `evidence/L2-engine-xray.jpg`
- **L3 ramp:** the courier is drawn normally on the deck at zoom 1.5 (t7690). The ghost is gone. There is still a wrecked blue car on the deck at x≈180 (t7999) whose nose sits into the parapet, and its left half is dithered (P3 #12).
- **L3 smoke:** the street smoke is now light grey billowing puffs, and reads as smoke (Maple Hardware t2641). The tall columns behind the ramp are still dark stacked teardrops (t7690), but no longer curtains over the street. The thinning near the courier shows as a dark dithered disc inside the puff (P3).
- **L3 worn arrows:** a pale, faint arrow on the road (t4246 crop). It reads as old paint now.
- **L3 bar cap:** at most about 5–6 bars over the hordes in every L3 frame (t3637, t4246, t7999).
- Evidence for all L3 items: `evidence/L3-recheck.jpg`

### L6

- **Northgate collider:** the preset run finished through Northgate, and the result card sits behind the NORTHGATE grille with the riot cops on the far side. I saw no clipping.
  - In the fresh run the courier stalled for 150 s at the earlier `gate-90` grille ((89–93, 14–17); #5).
  - In t9866 the male courier is drawn over the top of the grille cage, so he reads as standing on it.
- **Carried residents in the shelter:** not identified in any frame.
- **Riot shield strain:** the "SHIELD STRAIN · CHIP" label shows over the riot cops (fresh t2486). Two 600-HP riot cops stayed at 446/600 HP for 90 s in front of the MG courier at the gate (fresh t18783). The god-mode driver shoots into the shield.
- **Shelter recovery corpses:** the bodies lie on the shelter floor in the wide retreat shot (fresh t3255, high, z1.5).
- Evidence: `evidence/L6-gate-stall.jpg`, `evidence/L6-misc.jpg`

### L7

- **New opening pack (kerb cluster plus verge ranks):**
  - In the **fresh** save the courier took the launcher at t97 with no contact.
  - On the **continue** (L7-default preset) save, a horde is on her from t84 ("damage" events every few ticks), and the pack fills the truck kerb by t321. She never closes the 3 m to the launcher, and the run "dies" at t7042 (god-mode fixture) and restarts. After the restart she got the launcher in 17 s.
  - #2, `evidence/L7-opening-mob.jpg`
- **Follower motion:** the survivor column walks tidily behind the courier at zoom 1.5 (preset t9641–t13177). I saw no twitching and no stragglers left in the frames.
- **Boarding:** in both runs the group waits ("Waiting for a survivor · 3 m") while the horde reaches it, and the count drops. #4, `evidence/L7-bus-losses.jpg`
- **Off-screen alarm:** "Survivor lost behind you!" and "Survivor under attack! Turn back!" both show, sometimes at the very start of the corridor (fresh t624).

### L8 to L10

- **L8 APC armour warning:** the "Armor 1000 / 1000" bar is visible on foot through the escape, and it drops visibly (980 → 830 → 820). The run never reached ≤ 25 %, so I did not see the "CRITICAL" state.
- **L9 quiet-interval patrols:** only single infected or pairs (preset t4238, fresh t4222). They barely touch the APC (#6).
- **L10 console charge visibility:**
  - The HUD shows "Defend the dispersal console · Charge n/60 s". The console's screen glows.
  - I saw no world-space charge meter on the console itself. At zoom 1.5 the only charge cue is the HUD line.
- **L10 roof reveal:** not judged. The console roof never covered the courier in my frames.
- **L10 Mega walk and arrival:**
  - The minimap badge goes "distant → approaching → near" through the hold.
  - The Mega arrives at the end of the charge as a pale, horned brute with a red eye and a long bar. It reads well at zoom 1.5 (`evidence/L10-finale.jpg`, crop).
  - It died about 15 s after "Kill the Mega Alpha" in both finale runs (#11).
- **L10 assault waves:** dense, all around the console (minimap fully red), with 60+ infected ringing the courier (WebGPU t4177). Not harmless.
- **L10 corridor patrols:** none seen. There were 0 infected within the observation radius for the whole destroyed corridor (#7).
- **L10 military escape flank:** not identified in any frame.
- **L10 fight stays on the apron:** yes. Every hold and Mega frame is on the apron around the console and its stairs.
- **L10 console-top fall:** not seen. The driver never climbed the console.
- **L10 corpse spreading at the ending:** the bodies are spread across the whole apron in one layer, with no mounds. But they read as shards (#1).
- **Infected lean (40° cap):** in the dense close crowds (L10 WebGPU low t4177, L7 preset t7865, L6 fresh t4973) I saw no infected leaning beyond a normal hunch.

## Ranked list

### P1
None.

### P2
1. **L10 apron corpses read as flat red/navy triangle shards, not bodies.**
   - **Where:** hold, Mega fight and epilogue, around the dispersal console (≈ 4000, −30).
   - **Seen in:**
     - WebGL2 high: t29852 (low z0.5), t31057 (high z1.5)
     - WebGPU high: p4 t6587, t14279 (z0.5)
   - **What:** at close zoom, only a few still show a "GRILL & CHILL" shirt print. Most are crumpled sheets of red and navy triangles. At zoom 1.5 the apron is a confetti field. The 150 s "Watch the cure spread" epilogue stares at this field.
   - **Checklist:** fails P1-117 ("Corpses look like bodies up close") on L10.
   - **Open question:** whether this is the corpse-spread change (G-14) flattening the meshes or rocket gibs. Needs a Scene Lab corpse check plus an A/B against PROD.
   - Evidence: `evidence/L10-corpse-shards.jpg`
2. **L7 continue-save opening: the courier is mobbed before she can take the launcher.**
   - **Where:** preset L7-default, WebGL2 high, at (273, 15).
   - **What:**
     - "damage" events from t84;
     - the horde is packed around the truck by t321;
     - "Recover the rocket launcher · 3–8 m" from t3 to t7042;
     - then a god-mode "death" (`releasedInputAfterDeath` 7042) and a restart.
   - **Contrast:** the fresh run (level select) took the launcher at t97 with no contact.
   - **Risk:** a player arriving from L6 meets a pack before they can arm.
   - Evidence: `evidence/L7-opening-mob.jpg`
3. **L7 point-blank rocket: the fireball draws as an opaque orange torus with a hard hole cut around the courier.**
   - **Where:** fresh WebGPU low, t4567 (zoom 0.5).
   - **What:** it reads as an inflatable ring, not fire. At low quality (preset t8165) the blast is a large flat orange disc with a dithered edge.
   - **Not a white-out:** Q-148 holds.
   - Evidence: `evidence/L7-rocket-torus.jpg`
4. **L7 boarding bleeds the group out ("babysitting").**
   - **Fresh:** "Aboard 0/17 · Waiting for Marcus · 3 m" (t5926), then "Aboard 0/8 · Waiting for a survivor · 1 m" (t7225), then **"Aboard 0/0 · Everyone aboard"** (t7596), and the level ends with nobody saved.
   - **Preset:** "Aboard 0/23" → "0/18" while waiting at 44 m from the bus (t17082–t18550).
   - **Caveat:** the god-mode driver does not guard the group. But the waiting rule holds the group in place while the horde arrives. "Everyone aboard" with 0/0 is wrong wording (P3).
   - Evidence: `evidence/L7-bus-losses.jpg`
5. **L6 fresh: stall at the `gate-90` grille.**
   - **Where:** "Stay with the group · 3–17 m" from about t10000 to t18823, a 90 s no-progress stop. Marker at (92.4, 17.3); the courier at (89–110, 14). Two 600-HP shield riot cops are at 1.2 m.
   - **What:** the male courier is drawn on the grille cage top (t9866), and the big gold marker pentagon is drawn on the grille (t18823).
   - **Caveat:** likely partly the driver (it does not press E at the gate, and it shoots into shields). The preset run passed. A human try should check that the gate marker is reachable while two riot cops hold it.
   - Evidence: `evidence/L6-gate-stall.jpg`
6. **L9 drive is harmless.**
   - **Numbers:** about 90 s across a dark, featureless field. Armour lost is 20 of 1000 (preset) and 30 of 1000 (fresh).
   - **Patrols:** single infected or pairs. "Every hit costs armor", but nothing hits.
   - Evidence: `evidence/L9-drive.jpg`
7. **L10 traversal is empty.**
   - **Overland:** residential fringe → industrial → military → campus is about 8 min of walking on dark grass, with only a few infected.
   - **Corridor and dispersal approach:** destroyed corridor and dispersal approach: 0 infected near the courier from t5023 to t15191 (resumed run), so no corridor patrol was met.
   - **Checklist:** conflicts with F-322 ("many scattered single infected").
   - Evidence: `evidence/L10-empty-traverse.jpg`

### P3
8. **L2 fire-engine x-ray:** she reads as standing on the engine roof (see re-check). `evidence/L2-engine-xray.jpg`
9. **L6 alarm fatigue.**
   - "Survivor under attack! Turn back!" is on screen in nearly every retreat frame of both runs (fresh t3724–t18823).
   - The preset ended with 28 of 29 lost (driver).
   - `evidence/L6-misc.jpg`
10. **L6 HUD crop.** The "Into the tunnel! Everybody, move!" bubble is cut off at the top edge (fresh t3255, low z0.5). `evidence/L6-misc.jpg`
11. **L10 Mega fight length.** The Mega dies about 15 s after "Kill the Mega Alpha" with the rocket launcher (WebGL2 t30040→t30908, WebGPU t5175→t7001). The climax is shorter than the hold before it.
12. **L3 deck wreck.** A wrecked blue car on the raised deck near x≈180 sits nose-first into the parapet, and its left half is dithered. `evidence/L3-recheck.jpg`
13. **L7 launcher ring under the survivors.** The launcher ring is covered by survivors standing on it at the truck (preset t7865, low z0.5). `evidence/L7-opening-mob.jpg`
14. **L6 night exit light disc.** It is a large, hard-edged round light disc centred on the courier on the purple street (preset t11202, low z0.5 and high z1.5). `evidence/L6-misc.jpg`
15. **L7 departure road paint.** It has bold red chevrons (preset t17082, high z1.5), which may read as route steering (G-08).
16. **L8 crowd overlap.** Survivors stand inside the courier at the bus (fresh t675: the launcher passes through a survivor). Elsewhere the courier is drawn over a bare tree that stands between her and the camera (fresh t5208). `evidence/L8.jpg`
17. **L8 male courier carry pose.** He runs with the rocket launcher pointed straight at the ground (fresh t4280, t4891). It is likely a lowered-carry pose, but it reads oddly at close zoom. `evidence/L8.jpg`
18. **L9 APC hull.**
    - Blood on the hull is drawn as flat, round red ovals (preset t4238, fresh t5626).
    - The APC shadow has a stepped, blocky edge (t2487).
    - `evidence/L9-drive.jpg`

### Driver/harness notes (not game bugs)
- **L6 and L8:** both "stuck-navigating" at the start. L6 is the calm shelter phase with no marker, and L8 is the calm zoo phase with no HUD objective (about 20 s each).
- **L2:** stalled 20 s at "Take the fire axe" again.
- **L10:** the 9-minute level cap ended the start run at the research step, and the 10-minute pool lease closed the first finale run in the epilogue. Neither is a game crash. Chaining runs with `keep` and a sub-10-minute `seconds` value works.
- **L10 `tracked` source:** broken (missing commit), see Tooling.

## Coverage

| Run | Save | Survivor | Backend / tier / base zoom | Result |
|---|---|---|---|---|
| L6 | preset L6-default | female | WebGPU high 1.5 | finished (1/29 out) |
| L6 | fresh | male | WebGL2 low 0.5 | gate-90 stall, cannot-finish at t18823 |
| L7 | preset L7-default | female | WebGL2 high 1.5 | opening mob, restart, finished |
| L7 | fresh | male | WebGPU low 0.5 | finished (0 aboard) |
| L8 | preset L8-default | female | WebGPU low 1.5 | finished |
| L8 | fresh | male | WebGL2 high 0.5 | finished |
| L9 | preset L9-default | female | WebGPU high 1.5 | finished |
| L9 | fresh | male | WebGL2 low 0.5 | finished |
| L10 | preset L10-default (start → research) | female | WebGL2 high 1.5 | 9-min cap at t30441 |
| L10 | fresh | male | WebGPU low 0.5 | 9-min cap at t29963 (campus) |
| L10 | keep (research → epilogue) | female | WebGL2 high 1.5 | pool lease cap at epilogue 23/150 s |
| L10 | keep (research → hold) + keep (hold → credits) | female | WebGPU high 0.5 | finished, credits |
| L2 | preset (doors re-check) | female | WebGPU high 1.5 | finished |
| L3 | preset (ramp/smoke/bars re-check) | female | WebGPU low 1.5 | finished |

Every run also took per-step photos at low/high × zoom 1.5/0.5. That covers both backends, both tiers and both zooms on every level. The L10 finale is covered on both backends at high base quality, with low-tier step photos.

**Not covered:**
- An A/B against PROD.
- Perf.
- The male courier in the L10 finale.
- The L10 console-top fall and the military escape flank (the driver never triggered them).
- The L6 carried residents.
