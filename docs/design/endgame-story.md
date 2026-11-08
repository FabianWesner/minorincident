# Endgame storyline L8 → L9 → L10 (r13-l9l10concept, 2026-11-08, for PO review)

PO 2026-11-08: "This needs a full story line re-conception." This page gives the story first, then the beats per level, then the plan. The gameplay detail for L9/L10 (mechanics, broken-today list, spec changes, dog, minimap icons) is in [l9-l10-concept.md](l9-l10-concept.md). The L8 base is the r12-l8story concept (`lane/r12-l8story:docs/design/l8-concept.md`), kept and extended here.

## The story in one page

The courier started this. In L1 she delivered one cold-chain parcel to the Medical Annex, and minutes later the Annex blew. Since then she has run with whoever was left: firefighters (L2), police (L3), the army (L4). Then she searched the ruins for **Sam, Mia, Rosa, Dale and Mr. Okafor** (L5), protected them underground (L6) and blasted them out of a dead city to an evacuation bus (L7). The corgi has been with her all day.

**L8 The Zoo:** the bus brings the group to the zoo, an army sanctuary. For one minute it is peaceful: animals, keepers, soldiers, and on the commander's radio a broadcast: *the research campus past Hollow Creek has a cure, and the army is evacuating from the Hollow Creek bridge.* Then the tunnels open, and the animals the player just admired turn in front of her. While she gets the group to the armored vehicle, **something new comes over the north wall**: an Alpha that soldiers cannot stop (the **Mega Alpha**). It kills Major Hale at the APC. Hale presses the keys into her hand: "Hollow Creek. Get them out."

**L9 The Crossing:** she drives the APC across open country at night with everyone aboard, racing the city's migrating horde to the bridge. The APC is armour, not safety. Infected board it, dogs leap at it, and a stall on the railway tracks forces her to stand in the hatch and fight with everything she has, the last time she will have it. At the bridgehead the survivors climb onto the army trucks: Mia, Rosa, Dale and Mr. Okafor are safe. The trucks go north; the cure lies across the river. Sam stays: "Someone has to watch your back." On the bridge the Mega Alpha drops onto the hull, and the span gives way under the APC, the Mega and the horde. Her guns burn in the wreck. She crawls out with the axe on her back.

**L10 The Cure:** she is alone on the wrong bank with an axe, and the thing climbs out of the wreck behind her. Sam's voice on the radio pulls her forward: he is hurt and heading for the depot. She arms herself on the way:
- the **handgun** from a dead officer at an overrun police roadblock;
- the **shotgun** from Sam at the depot, where she saves him and two workers;
- the **machine gun** at the army armory, which Sam pays for with his life when the Mega catches him ("Short bursts. Go.").

At the campus a scientist's recording tells her what the parcel was. **The cold-chain sample she delivered that morning came from this campus.** The cure is its counter-agent, airborne, lethal only to the infected. With the canister on her back and the Mega on her heels, she reaches the dead escort convoy and its **rocket launcher**, then the dispersal complex. She holds the console, kills the Mega and releases the cure. As the mist rolls out, infected collapse, survivors come out of hiding (the depot workers among them), and her phone buzzes, as in L1: **"Delivered ✓"**. Title: **Minor Incident**.

**Arc:** she caused it with a delivery (L1), and she ends it with a delivery (L10). L8 is the last moment of safety, L9 is the last time she has everything, and L10 is losing everything and earning it back.

*Continuity rules:* named survivors appear only if alive in the campaign save. If Sam died earlier, a zoo soldier ("Private Reyes", met in L8) takes his role in L9/L10. The corgi is always present and never harmed.

---

## L8 The Zoo — "the last safe place" (~8 min)

PO 11-08: "the Zoo level shouldn't be another slaughter tons of Zombies with the rocket launcher at once. I imagine it more like fighting 'kind of end bosses'." The r12-l8story beats stand (sanctuary tour past the animals → bite and turn at the fence → outbreak → hold at the APC → departure). Beat 3 becomes a chain of **animal mini-boss arenas** on the way to the APC.

**Regular infected cut to about a third.** They are only background pressure (turned staff and soldiers) between the arenas. Each arena is a short fight (45–90 s) against one infected animal or one coordinated group, with a health bar, clear telegraphs and one tactic that wins.

**Rocket launcher limited in L8:** cooldown doubled (matching the PO's L7 rocket-rate halving), and animals take 50 % explosive damage outside their vulnerable window. Rockets help, but only at the right moment.

| Arena (route order) | Animal | How it attacks (telegraphs) | Tactic that wins | Reuse / new |
|---|---|---|---|---|
| Flamingo pond | Flamingo flock (6–8) | Swarm, then dives from above in a line (shadow on the ground, 0.6 s). | Area weapons: shotgun or MG sweep; step out of the shadow line. Short tutorial arena. | `flamingo.dive` exists; flock grouping is new. |
| Zebra paddock | Zebra herd (4–5) | **Stampede** down a lane (dust and hoofbeat rumble, 1 s), then single kicks when close. | Get out of the lane (the herd turns at fences), then shoot the stragglers that stop to kick. | `zebra.stampede/kick` exist; herd lanes are new data. |
| Primate house | **Monkeys, a coordinated pack** (6–10, small, fast) | Surround and harass from roofs and fences, then grab and pull (they steal the courier's focus: weapon swap blocked 2 s) while others bite. They flee when hit and come back from another side. | Fight in a choke point (the primate-house doorway, so they come one side at a time); the corgi barks at the one flanking. | **New**: `inf.monkey` derived from the cat/dog animal pipeline, plus a pack-flank brain (shared with the dog pack). |
| Lion enclosure | Lion (one, plus a lioness later) | **Stalks** from cover (low growl, disappears behind rocks), then pounces (crouch plus eye glint, 0.6 s), pins and bites. | Dodge sideways on the crouch. It is open during the 1.2 s recovery after a missed pounce: shoot or axe it then. | `lion.pounce/flank` exist; stalk-from-cover and the recovery window are new. |
| Gorilla house | Gorilla | **Chest-beat roar** (stuns within 8 m, 1 s windup), throws barrels and benches, ground pound (ring telegraph). | Break line of sight behind the pillars to dodge throws, stay out of roar range, flank it while it pounds. Rockets are full damage while it beats its chest. | `gorilla.roar/pound/grab-throw` exist; the vulnerable window is new. |
| Elephant yard (last, before the APC) | Elephant | **Unstoppable charge** (trumpet plus a foot stamp, 0.9 s), trunk swipe when close. | Sidestep so it **charges into a wall or truck** and gets stuck for 3 s (full damage, rocket window). | `elephant.charge/swipe` exist; stuck-on-impact is new. |
| APC hold (beat 4) | Turned K9s + soldiers, then sighting 0 | — | Cover the boarding; the Mega arrives and kills Hale (story beat, not a fight). | As below. |

Each arena checkpoints on entry. The survivor group waits at a safe gate during the fight; nothing to babysit. Animal HP is tuned so each arena takes 45–90 s with the right tactic and is much harder without it.

Additions from the endgame story:

| Beat | Addition | Why |
|---|---|---|
| 1 Sanctuary tour | The commander's post at the central plaza plays the army radio broadcast (caption): "…research campus past Hollow Creek… a cure… evacuation from the Hollow Creek bridge…". Major Hale greets the group. | L9/L10 motivation is set up on screen instead of in a briefing line. |
| 2 From below | Turned army K9s come out of the tunnels with the first wave (dog introduction for the endgame). | Recurring dog enemy. |
| 4 Hold at the APC | At the end of the hold, **sighting 0**: the Mega Alpha comes over the north wall. Soldiers' fire does not stop it. It kills Hale beside the APC (off-centre, short, no gore close-up). Hale throws the keys: "Hollow Creek. Get them out." The courier boards last. | Introduces the Mega as a character with a face and a crime. The player cannot fight it yet. |
| 5 Departure | Through the east gate. The Mega is seen in the rear view, running after the APC. | It is following her; L9 ends with it. |

Climax: the animals the player admired become boss fights one by one, the elephant the last of them, and then comes the unkillable thing that kills the commander.

## L9 The Crossing — "get them to the bridge" (~7 min)

Beats (details in [l9-l10-concept.md](l9-l10-concept.md)):
1. **Out of the zoo** (0:00–0:45): an infected lion boards the hull; the player learns the shake-off.
2. **Choose a crossing** (0:45–3:00): road, countryside or shortcut, each with its own threat mix and roadblock; migration streams cross the land.
3. **Stalled at the railway crossing** (3:00–4:15): hold E to restart the engine while the courier fights from the hatch with her full arsenal.
4. **Evacuation point** (4:15–5:45): the survivors get onto the trucks under a 30 s defence; Sam climbs back in.
5. **The bridge** (5:45–7:00): the horde on the deck; the Mega boards; the span collapses with the real APC motion. The weapon rack burns in the creek bed, Sam is thrown to the far bank, and the courier crawls out with the axe on her back. The wreck explodes.

Climax: the bridge collapse caused by the Mega, the enemy introduced in L8. The loss of the arsenal is shown, not stated.

## L10 The Cure — "alone, hunted, rebuild, deliver" (~35–40 min competent, 45–50 newbie)

The level keeps its size and the long walks (PO). Its tone is survival horror, not crowds: quiet dark stretches with dread cues (sounds in the dark, lights flickering out, the corgi growling, the distant Mega), rare jump scares by stronger and faster infected and small hunting groups, continuous sparse scenery across dry corn fields and dead farms under a dark, desaturated late-autumn look (bare trees, brown stubble, mud, fog banks, no green) (corn hides the scares), an apocalypse dressing pass on the houses, and a dark ambient score with silence before each scare (rock only for the Mega climax). The only crowd fight is a smaller console assault around the Mega fight. Every weapon comes from a scene with a reason:

| Region | Story goal (objective) | Weapon and its story | Climax / threat |
|---|---|---|---|
| R1 creek bed | Climb out | — (axe on her back) | Fallen infected rise around her. The Mega climbs out of the wreck: sighting 1, and the red dot appears. Sam on the radio. |
| R2 residential | Follow Sam's trail / search the police roadblock | Handgun: dead officer's holster in the overrun cruiser | A dark street with scares from cars and doors, or the backyards. The cruiser siren calls a few fast ones and a K9: a 30 s hold. |
| R3 industrial | Reach Sam at the depot | Shotgun: from the depot guard locker, handed over by Sam | Rescue plus a 45 s gate hold; Sam and two workers follow. |
| R4 military | Open the motor-pool armory | Machine gun: Sam slides it across as the Mega grabs him | Mounted-gun wave, then sighting 2 and Sam's death. Alone again. |
| R5 research | Hear the recording, pack the cure, get out | — | The recording reveals the L1 parcel. Lockdown flood, nurses reviving the dead, and the Mega breaks in (sighting 3, chase). |
| R6 corridor | Reach the escort convoy | Rocket launcher: lead truck of the wrecked cure convoy, a dying soldier's radio | Optional Mega duel (stagger or kill early) vs running with the canister. |
| R7 complex | Deliver the cure: install, charge, kill the Mega, release | Mounted minigun at the console | A smaller directional assault that continues until the Mega is dead. The Mega fight. Release. |
| Epilogue | Watch the cure spread | — | Collapse, survivors emerge (depot workers), "Delivered ✓", pull-out, title, credits. |

New recording text (replaces `cureRecordingText`): "…the sample shipped to the Sunset Grove Medical Annex this morning was the active strain. If you are hearing this, it is out. The counter-agent in this canister is airborne. It is harmless to the healthy, kills the infected and does not bring anyone back. Take it to the dispersal complex."

Pay-off check: the delivery (L1) matches the delivery (L10), the commander's broadcast (L8) leads to the bridge (L9) and the campus (L10), and the Mega that killed Hale (L8) is also the one that broke the bridge (L9), took Sam (L10) and dies at the console (L10).

---

## Implementation plan (7 lanes, after PO approval)

| Lane | Model, time | Scope |
|---|---|---|
| L8-story (r12 plan) | Opus, ~2.5 h | r12-l8story lane 1, plus the commander broadcast, the K9 wave, and the Mega sighting 0 with Hale's death at the APC (scripted, reusing the Mega asset and Alpha moves; the Mega leaves via the north gate, it is not killable). |
| L8-bosses | Opus, ~3 h (+ Sonnet asset lane ~2 h for `inf.monkey` with LOD budgets) | Arena chain: regular infected cut to a third, vulnerable windows (lion recovery, gorilla chest-beat, elephant stuck-on-impact), herd lanes, flamingo flock, monkey pack brain, L8 rocket limit. Scene Lab arena per animal with telegraph captures. |
| L9-A systems | Opus, ~3 h | Boarding/shake-off, heavy rams, stall plus hatch fire, the no-idle-spawn helper. |
| L9-B content + ending | Opus, ~3 h | Routes, migrations, evacuation drop-off (Sam stays), Mega boarder on the bridge, real-motion collapse, weapon loss shown, crawl, explosion, L10 creek-bed start and captions. |
| L10-A regions + story | Opus, ~3 h | Story objectives and weapon scenes (roadblock, depot rescue, armory with Sam's death, escort convoy), Sam radio and follower, moving encounters, release gate removed. |
| L10-B Mega/HUD/dogs/dressing | Sonnet, ~3 h | Minimap icon language, Mega red dot, sightings 1/3 plus the corridor stagger, assault until `mega-dead`, dog superpowers, apocalypse house dressing. |
| L10-farm + audio | Sonnet/Opus, ~3 h | Corn fields and farm dressing with their sight and nav rules; L10 dark-ambient music streams and scare stingers (details in l9-l10-concept.md). |
| Story text | Haiku, ~0.5 h | `dialogue.ts` lines (L8 broadcast, Hale, Sam, L10 briefing/crash, new recording, "Delivered ✓" epilogue toast), checked against the save roster fallback (Sam → Reyes). |

Order: L8-story and L9-A in parallel → L9-B → L10-A and L10-B → story text → Opus visual QA and a playtest of L8–L10 before any PROD deploy. Every lane runs focused checks and one real-input run of its level. Perf runs in the orchestrator's quiet window.
