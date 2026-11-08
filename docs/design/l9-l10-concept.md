# L9 "The Crossing" + L10 "The Cure" — gameplay re-conception (r13-l9l10concept, 2026-11-08)

PO 2026-11-08 on PROD batch 59, verbatim:
- "L9 has no real challenge. I can just drive through it and I am done. This needs a re-conception for gameplay."
- "I also don't like to see Zombies that are positioned so they wait for me. This is a game internal. They should start moving before I can see them on max view height."
- "The end of L9 is super strange. Review it."
- "In L9 there seems to only one type of Zombie... why?"
- "L10 says the crash took everything except the axe, but in L9 the girl still had the launcher after the crash..."
- "L10 starts with walking a lot alone. Not fun!"
- "I got the hand gun with zero problems. Level 10 is far too simple (to this point) and also needs a re-conception."
- "I like the size of this level and also that I need to move a lot, but dislike that I am totally alone; no Zombies, not even scenery."
- "Why would show this message. Just show the mega alpha as a red dot; maybe with a bit of special effect, so it's clear this is not a regular one."
- "This house looks awesome, but not at all like something you would expect in a Zombie apocalypse."

Specs E31/E32 stay the source of truth. This page says what changes and how each beat plays. Clauses that must change are listed in "Spec changes" at the end. Driving steering (screen-relative) is owned by another lane.

## What is broken today (code + reports)

**L9**
1. **Nothing can stop the player.** 1,000 durability, −10 per contact, and at 0 HP the APC still drives at 60 % (`Vehicles.setFloorPolicy`). Courier HP is never at risk inside the hull, rams only knock infected down (0 vehicle kills, r10-l9), and there is no fail state, no forced stop and no decision with a cost. Measured drive time is 85–115 s.
2. **Infected wait.** `LevelNineEncounters.updateEncounters` spawns every authored group in `state: 'idle', yaw: π/2` as a 4-column block as soon as its 100 m chunk becomes resident. That is the screenshot `1108-l9-waiting.png`: three runners in a row, all facing the same way. The 12 singles ("wanderers") are idle too. Only the gap-filling patrols spawn in `chase`.
3. **One type.** L9 spawns only `infected.runner` (plus 2 Alphas on the shortcut). The roster already has sprinter, brute, bloated, crawler, screamer, armored, riot, dog and zoo lion/zebra/elephant.
4. **Strange ending** (`LevelNineCrash.ts`):
   - When the APC crosses x = 548 from anywhere, it is lerped to the bridge lip in 3 s with its yaw forced to 0, so it slides or teleports sideways. It then falls on a lerp while its yaw turns 90°.
   - Nothing on screen explains why the bridge fails.
   - The courier is placed at a crawl anchor and lerped 6 s. "Get clear of the wreck" appears after she is already clear.
   - The 12 passengers vanish into an off-screen "shelter".
   - PROD batch 59 (01:14) predates `2ee1abc9` (02:52), so the rocket launcher stayed drawn across the crawling courier. That is the PO's "girl still had the launcher".
   - L10's caption "The others made it to the evacuation point while you fell behind" refers to an evacuation the player never saw.
5. Flicker `1108-l9-flicker.png`: dark striped rectangles on a pale slab beside a railing (shadow acne or z-fight). This is a visual bug; it goes to the next L9 visual QA, not to this concept.
6. PROD batch 59 also lacks r10-l9 (flares, packs) and r9-l10pace/r10-l10 (89 crossing scenes, forecourts). The PO judged the levels without them. They help with emptiness, but they do not fix any point above.

**L10**
1. **The axe phase has no threat.** In `LevelTenEncounters.update`, every non-R1 group is held until `stats.time ≥ 60` **and** `player.x ≥ the region's checkpoint x`. Each weapon sits at its region's entrance checkpoint (handgun at x 767, 20 m into R2). So the player picks up every weapon before that region has a single infected. R1 has 8 runners in pairs over 220 m. Result: "got the hand gun with zero problems".
2. **Long empty fields.** The objective marker points straight at the next checkpoint, so players cross fields 75–100 m from the road, where all encounters and dressing sit (r9-l10pace measured 562 of 1,062 s empty). Main now has the crossing scenes, but enemies on those lines are still once-only stations.
3. **The Mega is abstract.** It is heard (roars) and shown as a text band "Mega Alpha: distant/approaching" (`megaPresentation.ts`). The player never sees it before the finale.
4. **Empty wait in the finale.** The assault stops spawning at `charge-ready` (60 s), but the Mega reaches the arena about 140 s after activation (PO 10-16) or 218 s on shortcut routes (pre-uat-l10, P2). That leaves 80–160 s of nothing.
5. **Not an apocalypse.** Intact lit suburban houses (porch lights, string lights, parasol, table) read as a holiday, not a collapse.

## Shared rule for both levels: nobody waits

- No infected spawns in `idle` on a route.
- Every spawn is either moving (migration stream, hunting pack, chase) or busy with a visible activity: feeding on a corpse, banging on a car or door, clawing a fence.
- Activation happens before the actor can enter the **max-zoom-out frame** (zoom 0.5, about 70 × 40 m around the player; in the APC add 2 s × speed ahead). Test against a fixed zoom-0.5 frustum, not the current camera. That means ≥ 60 m on foot and ≥ 90 m in the APC, outside that frustum.
- Groups move toward something the player understands: the APC's engine noise, the burning city, the bridge, or the player.
- Gate: a sim check that no infected is ever first drawn in `idle` inside the zoom-0.5 frame.

Reuse: `SpawnDirector.safe/offscreen`, migration streams (`SpawnDirector.migrations`), `pursueTarget`. New: a zoom-0.5 frustum for admission, and an activity pose set (corpse feeding already exists in L1/L3 ambience; reuse it).

---

## L9 · The Crossing — "get the survivors to the bridge before the horde does" (~7 min)

**Motivation:** the APC carries the L8 survivors. Army radio: the last evacuation point is at the Hollow Creek bridgehead, and the horde migrating out of the burning city is heading the same way. The player's job is to get everyone there and over the river.

**New core verbs:**
- **Shake off boarders.** Sprinters, crawlers, dogs and the lion can jump onto the hull when they reach it alongside. They take one of 6 hull slots (≤ 25 % HP adds 2 slots for broken hatches), climb for 3 s, then hit the driver in the open cab (10 HP per hit, 1 s cooldown). Throw them off with a hard swerve (yaw-rate threshold), by scraping that side along a wall, tree or wreck, or by braking hard (front boarders fall off and go under the wheels). This puts **courier HP** at stake. Death means a checkpoint.
- **Ram or route around, at a real cost.** Brutes and armored infected are heavy: ramming one costs −40 and stops the APC dead. A bloated infected explodes on contact (−60 HP, but it blasts every boarder off). Runners keep the −10. Durability still never breaks the APC (PO 10-13), but low HP lowers the speed cap and opens extra boarding slots, so a badly damaged APC gets swarmed.
- **Route decisions.** The three routes keep their geometry, and each gets its own threat profile and one roadblock:
  - **Road:** fast. There is a pile-up roadblock of light obstacles you can push through slowly (3 m/s for about 8 s while sprinters board) or detour around on gravel. Brutes stand in the lane.
  - **Countryside:** farms and fences. Screamers in the fields pull dog packs onto your line. Light fences cost little.
  - **Dry shortcut:** shortest, with the most risk. Soft ground caps speed at 12 m/s, so sprinters catch up. There is a zebra stampede crossing and the infected elephant from L8, which charges the hull (−80, heavy stop).

| # | Beat | Min | Goal / what the player does | Threats and decisions |
|---|---|---|---|---|
| 1 | Out of the zoo | 0:00–0:45 | "Drive to the evacuation point." Leave the zoo road. The escaped infected zoo animals (zebras, lion) are already running after the APC. A lion leaps onto the hull and the player learns the shake-off (caption hint once). | Lion boarder, zebra chasers. Nothing waits; everything comes from behind or the side. |
| 2 | Choose a crossing | 0:45–3:00 | Choose road, countryside or shortcut at the fork (route signs and the city glow). Plan around visible migration streams crossing the land toward the city. | Route profiles above. A migration stream (20–30 runners plus sprinters) cuts across each route. Drive into it and get boarded, or wait or detour and lose time. |
| 3 | Stalled | 3:00–4:15 | All routes meet at the railway level crossing (`mid-crossing` checkpoint). A brute or bloated hit at the tracks stalls the engine (scripted, at any HP). "Hold E to restart the engine": 25 s of cranking that pauses while you are not holding it. Meanwhile the courier stands in the hatch and **fires her current weapon** (the full L8 arsenal, the only time in L9), facing 360°. Armed adults among the passengers fire too (existing ally combat). | Horde from all sides plus boarders. Decision: crank (vulnerable) or shoot (the restart pauses). Death returns to `mid-crossing`. |
| 4 | Evacuation point | 4:15–5:45 | Reach the army bridgehead: sandbags, floodlights, trucks. Pull into the marked bay. The passengers get out and run to the trucks (existing passenger exit) while soldiers hold the sandbag line and the player rams or shoots what breaks through for about 30 s. Officer: "Trucks are full and the convoy goes north. The campus is across the river. Take the APC over before the bridge goes." Sam (L5 survivor) climbs back in: "Someone has to watch your back." | Directional waves at the sandbag line plus the first dog pack. Passengers who die stay dead (counted, not a fail). This shows on screen what L10's "the others made it to the evacuation point" claims. |
| 5 | The bridge | 5:45–7:00 | Courier, Sam and the corgi drive onto the bridge. The city horde pours onto the deck and the player pushes through them (big ram moment). Mid-span, **the Mega Alpha** (first seen at the zoo gate in L8) drops onto the hull: the objective becomes "Shake it off!" (it is a boarder that cannot be thrown). The span **cracks and tilts in view** under the APC, the Mega and the horde. | Ending, below. |

**Ending (replaces the lerp):**
- The trigger is the APC on the authored bridge deck. All routes funnel to the bridgehead, so there is no "crossed x = 548 anywhere".
- The deck span rotates down (`kit.crossing-crash` bridge piece animated as one rigid node), and the APC **keeps its own velocity and heading** as it slides off the tilt. Use a physics impulse or a scripted pose that starts from its real transform, never a lerp to the lip. It lands in the dry creek bed on its side; infected and the Mega fall with it.
- During impact the rear hatch bursts: the weapon rack and duffel tumble out into the burning fuel pool (one 2 s camera hold on the burning weapons, caption "The weapons are burning with the APC"). Sam is thrown clear onto the far bank and is seen limping away into the dark (or calling out).
- The courier crawls out of the cab under her own input (crawl 5–8 s). Her held weapon is hidden and the **axe is on her back** throughout.
- The objective reads "Crawl clear of the burning wreck" **before** the crawl. When she is clear, the wreck explodes (no way back) and L9 completes.
- No off-screen shelter: the passengers already left at the evacuation point.

**Checkpoints:** `crossing-start`, `mid-crossing` (before the stall), `evac-point`, `bridge`. No timer, fuel or repair.

## L10 · The Cure — "alone, hunted, rebuild the arsenal" (keep the size and the long movement; ~35–40 min competent, 45–50 newbie)

**Motivation:** the courier is stranded on the wrong side of the river. The campus has the cure, and the thing from the bridge is following her.

**Principles:**
- **Each weapon is the region's goal, guarded mid-region.** It is no longer a free pickup at the entrance. The region's infected are active **before** you get there (remove the `player.x ≥ checkpoint.x` gate). The checkpoint stays at the entrance so a death costs little. The pickup is a second checkpoint.
- **Never alone on the move.** On every field line, fixed once-only stations become continuous moving content:
  - a migration stream every 150–250 m crossing the walking line;
  - hunting packs (dogs, sprinters) that pick up the player's noise;
  - activity groups (feeding, banging on cars), started at ≥ 60 m.

  Target: an infected in the zoom-1 frame at least every 20 s, an attack on the player at least once per 60 s. Scenery: main's crossing scenes and forecourts plus a dressing pass to close the R1 and R7 gaps.
- **A new infected type per region.** R1 crawlers (leg-lost bridge fallers), R2 screamers + dogs, R3 bloated + firefighters + brutes, R4 riot + armored + sprinters, R5 hazmat + nurse (revives), R6 everything + Alphas.
- **The Mega is a visible hunter.** It appears as a **red minimap dot at its real position**, larger than normal dots, with a pulsing red ring and no text label. It also has three staged sightings before the finale. Roars and footstep audio stay.
- **Apocalypse dressing pass (all regions, R2 first).** Intact houses get the existing damage/decay variants: broken or boarded windows, kicked-in or boarded doors, burned or collapsed parts. Furniture is knocked over, lights are dead or flickering, and there is blood, debris and abandoned cars with open doors. At most one lit "last refuge" house per region, and only as a story beat (a barricaded porch, a body at the door, a message on the wall). No intact parasol, table or string-light scenes.

| # | Region / beat | Min | Goal (objective) | What the player does / threats / decisions |
|---|---|---|---|---|
| 1 | R1 creek bed | 0:00–2:00 | "Climb out of the creek bed" | Starts beside the burning APC wreck, under the broken bridge. Infected that fell with the bridge get up around her (4–6 crawlers and runners). Axe fight within 10 s. Climb the embankment ramp (about 80 m, not 220 m). At 0:45 **sighting 1**: the Mega climbs out of the burning wreck behind her and roars. The red dot appears. A radio crackles from the APC's handset on her belt: Sam, hurt, "I'm heading for the depot past the houses. Find me." |
| 2 | R2 residential street | 2:00–8:00 | "Follow Sam's trail through the houses" → "Search the police roadblock" | A police roadblock **in the middle** of the street was overrun (the L3 police collapse, one town later). The infested street (12–24 moving: feeding, banging on cars) has dogs and a turned police K9. Decide: fight up the street with the axe, sneak through the backyards (hedges break line of sight, dark dead houses), or send the corgi lure. The **handgun is in the dead officer's holster in the cruiser**. Opening the cruiser sets off its siren: a screamer call and a 30 s hold with the new handgun. Mega dot closing. |
| 3 | R3 industrial depot | 8:00–15:00 | "Reach Sam at the depot" → "Hold the gate with them" | Sam and two depot workers hold a bus barricade and are under attack when the player arrives. Reach them through bloated and firefighters in the yard (explosive barrels and bloated: shoot them in the crowd, never close up). Sam hands over the **shotgun from the depot guard's locker**. Hold the gate 45 s together. Then they **follow** (existing followers and ally combat) through R4: not alone. |
| 4 | R4 military zone | 15:00–23:00 | "Open the motor-pool armory" | A breached army checkpoint with riot and armored infected (the shotgun and handgun struggle against shields, so flank). Sam takes a dead sergeant's key card to the armory door while the player mans the existing **mounted gun** on a jeep for a 40 s wave. **Sighting 2**: the Mega smashes through the fence and grabs Sam at the armory door. He slides the **machine gun** across the floor to her ("Short bursts. Go."), echoing L4's "It is yours. Short bursts". Scripted death, no fail. The workers go back to hold the depot. From here she is alone again, and the player saw why. |
| 5 | R5 research campus | 23:00–30:00 | Recording → "Pack the cure" → "Get the cure out" | The lab is quarantine, so hazmat infected and nurses revive the fallen: kill the nurses first. Taking the canister trips the lockdown alarm and the campus floods with infected from the iso tents. **Sighting 3 / chase**: the Mega breaks in at the lab exit. It cannot be killed yet (conventional floor 90 %). Run to the corridor with the dot right behind. |
| 6 | R6 destroyed corridor | 30:00–37:00 | "Reach the cure escort convoy" → "Bring the cure to the complex" | The army convoy that was supposed to escort the cure lies wrecked mid-corridor. A dying soldier on the convoy radio guides her to the **rocket launcher in the lead truck** ("You can hurt it with these"). Horde lines plus dog packs. With the launcher the player may duel the Mega now: 3–4 hits stagger it into a retreat for about 60 s, and a full 10 kills it early (existing rule). Decision: spend time fighting it now, or run. |
| 7 | R7 dispersal complex | 37:00–45:00 | Install → charge 60 s → kill the Mega → release | As E32, with two fixes: (a) **the assault keeps coming until the Mega is dead**, instead of stopping at `charge-ready`, so there is never an empty wait; (b) the waves come from three directions with riot shields and bloated in the mix, so the minigun alone is not enough. The Mega arrives on its ~140 s walk (PO 10-16 kept) or earlier if the player did not stagger it. Leaving the 25 m disc to rocket it pauses the charge: a real trade-off. |
| 8 | Epilogue + credits | 45:00–48:00 | "Watch the cure spread" | Unchanged: mist front, collapse, survivors emerge, pull-out, title, credits. The R3/R4 survivors are among those who emerge (continuity). |

**L9 → L10 handover:** L10 starts where L9's camera left off, in the creek bed beside the same burning wreck. The inventory is exactly [axe], already visible on her back during the L9 crawl. New L10 caption: "Your guns burned with the APC. Only the axe is left. The others are on the trucks north. Sam is somewhere out there, and so is the thing from the bridge." It replaces `L10.crash` and `L10.briefing` in `dialogue.ts`.

**Objective structure.** Drop "Recover the X at the checkpoint". Objectives name the story goal ("Follow Sam's trail", "Reach Sam at the depot", "Open the armory", "Reach the escort convoy"). The weapon is what that scene yields. Checkpoints stay at region entrances and on each pickup.

## Infected dog: recurring special enemy (PO 11-08)

"L10 has a Zombie dog. Put this also to other levels and give it some super-powers (eg higher speed or jumping)".

**Superpowers:**
- **Sprint:** 1.5× the courier's run while hunting (today 1.1×).
- **Leap:** a telegraphed pounce. It crouches, growls, its eyes glint red and a ground streak shows the line, 0.6 s. It covers up to 5 m and **clears low obstacles** (fences, sandbags, car hoods), knocking the courier or a follower down (0.8 s, during which it bites).
- **Pack:** packs of 3–5. One barks and holds while the others circle to flank.

**Counter (learnable):**
- **Corgi warning:** the corgi growls toward an unseen pack before it appears (existing warn behaviour, dog-specific bark).
- **Dodge:** a sideways step during the telegraph makes the leap miss.
- **Timing:** a melee or shotgun hit during the leap staggers the dog (a parry reward).
- **Terrain:** doors and high fences stop it; low cover does not.

**Where:**
- **L6–L10 (proposed):** L6 a pair in the maintenance tunnels; L7 street packs in the night ruins; L8 turned army K9s at the breach; L9 packs that chase the APC and leap onto the hull as boarders; L10 every region, with a turned police K9 at the R2 roadblock.
- **L3–L5 (proposal only, PO-accepted levels):** L3 the police K9 turns during the station fall; L5 one stray pack in the ruins.

Reuse: `dogDef`/`dogTuning`, the animal pounce and stagger. New: the leap-over-obstacle move, pack flanking, the corgi dog-bark.

## Minimap icon language (all levels; PO: "♪ … we used this symbol to find survivors")

| Icon | Meaning (only this) |
|---|---|
| ♪ | A survivor heard calling (L5 meaning) |
| person ☺ | A known survivor to collect or regroup with (L6 regroup, L7 corridor/departure) |
| standard objective marker | The current objective, including L10 weapon scenes, terminal, console |
| ◆ cyan | Route turn (L4 cellar) |
| ⌂ | Safe place / home |
| red pulsing dot + ring | The Mega Alpha, real position, no text |
| orange dot | Alpha (regular) |
| small red triangle | Infected dog |
| red dot | Other infected |

Current conflicts (`src/ui/Hud.ts`):
- `cuePin` (♪) is reused by `waitCue` for the **L10 active objective after 5 s** (weapon pickups, terminal, console, "Cure dispersal"; around line 488). This is the PO's complaint.
- `cuePin` (♪) is also used for the **L6 regroup target** (line 448), the **L7 corridor missing survivor** (line 456) and the **L7 departure boarding target** (line 468). These are people, but not calls, so they move to ☺.
- All threats share one plain `hud-pin-threat` style, so Alphas and dogs are not distinguished.
- `megaPresentation.ts` band labels ("Mega Alpha: distant/approaching") are removed.

---

## Reused vs new

**Reused:**
- **Vehicle:** APC, durability and contact/surround attacks (`Vehicles.ts`), light and heavy obstacles (`Obstacles.ts`), passenger exit (`boardPassenger` reverse path).
- **Combat and actors:** ally combat, followers, mounted gun (E11), the whole infected roster including zoo animals and dogs, `SpawnDirector` safe/offscreen admission and migration streams, `pursueTarget`.
- **Level content:** checkpoints and mission steps, the crash state machine shell, `kit.crossing-crash`, E09 wreck/fire/explosion VFX, NightAccents flares and fires, L10 crossing scenes and forecourts, damage/decay prop variants.
- **Mega:** MegaPursuit and its resistances.

**New:**
1. Boarding system: hull slots, climb timer, driver damage, shake-off by swerve, scrape or brake.
2. Stalled-APC hatch defence: engine stall, hold-E restart, firing the current weapon while stopped. This reverses the E31 "no firing while seated" default only while stopped and only in this beat.
3. L9 encounter director rewrite: moving or activity spawns only, archetype mix per route, roadblocks, zoo chasers, level-crossing and evac set pieces.
4. Bridge-collapse set piece using the real APC transform, plus the visible weapon loss.
5. L10 creek-bed start: move the start anchor and spawn the bridge fallers.
6. L10 region objectives moved mid-region, the release gate removed, survivors at the depot, armory and jeep mounted gun.
7. Moving field streams along every walking line.
8. Three scripted Mega sightings.
9. Assault continues until `mega-dead`.
10. Mega minimap dot with a pulse ring.
11. Apocalypse dressing pass on D-CURE houses.

## Spec / acceptance changes (PO approval needed)

- **E31 §3 "Out: firing carried weapons from inside the vehicle"** gets one exception: the scripted stall beat. **§4/§5.4**: the evacuation drop-off replaces "survivors shelter near the wreck", and the crash trigger becomes the bridge deck. New checkpoints `mid-crossing`, `evac-point`, `bridge`. L9 time band 2–5 → **6–8 min**.
- **E32 §5.4/§5.5 "the player's minimap never receives an exact boss dot" / "no exact dot"** → a red pulsing dot at its real position, with no band text. **L10-07** "minimap shows only a pulsing distance ring" changes the same way. `megaPresentation.ts` labels are removed. (pre-uat-l10 `71827588` hid the objective waypoint under the old contract. The waypoint stays hidden; only the minimap dot is added.)
- **E32 §4 "Weapon pickups happen at the named checkpoint before its denser section"** → the weapon is guarded mid-region, and the threat is active before the pickup. L10-05 is reworded.
- **E32 §5.7 / L10-11**: the assault continues after `charge-ready` until `mega-dead`. The ~140 s Mega walk stays.
- New global row: no infected first drawn in `idle` inside the zoom-0.5 frame (both levels).

## Implementation plan (4 lanes, PO review first)

| Lane | Model, time | Scope | Check |
|---|---|---|---|
| L9-A systems | Opus, ~3 h | Boarding plus shake-off plus driver damage. Heavy-ram and bloated costs. Stall plus hatch defence. Shared "no idle in the zoom-0.5 frame" admission helper. | Unit/sim fixtures (board → shaken off by swerve; 4 boarders kill an idle courier; stall restart pauses); Scene Lab `qa-l9-boarders`, `qa-l9-stall`. |
| L9-B content + ending | Opus, ~3 h (after A's helper) | Route mixes, roadblocks, zoo chasers, migration streams, level crossing, evac point drop-off, bridge collapse from the real transform, visible weapon loss, crawl with the axe on her back, wreck explosion. Also the L10 creek-bed start and caption. | One real-input run per route (low/high, zoom 1/1.5) with captures of every beat and the ending; idle-spawn probe = 0; L9 6–8 min. |
| L10-A regions | Opus, ~3 h | Remove the checkpoint-x release gate. Weapons mid-region with guards. Moving field streams on every walking line. Per-region archetypes. R3 survivors and gate hold, R4 armory, jeep mounted gun and the survivor-grab sighting. | Empty-stretch meter (r9-l10pace tool): infected in frame at least every 20 s; `qa:threat` L10; one unprotected real-input run R1–R5. |
| L10-B Mega + finale + dressing + HUD | Sonnet, ~3 h | Minimap icon language (table above, all levels) including the Mega red dot and ring (remove the band label). Dog superpowers (leap over low cover, pack flank, corgi dog-bark). Sightings 1 and 3 plus the corridor stagger-retreat. Assault continues until `mega-dead`. Apocalypse dressing pass on D-CURE houses (decay variants, at most one lit refuge per region). | Finale run: no 10 s window without an attack after `charge-ready`; minimap captures; R2/R3 house sheets at low/high, zoom 1/1.5. |

L9-A and L10-A can run in parallel. B lanes follow their A lane. Perf runs in the orchestrator's quiet window. Followed by an Opus visual QA and a playtest of both levels before PROD.
