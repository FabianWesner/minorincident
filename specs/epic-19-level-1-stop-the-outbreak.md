# E19 · Level 1: Special Delivery (Stop the Outbreak)

> **Rewritten 2026-10-06 per product owner** (Level 1 v2 design, `epics-pipeline/l1v2-design.md`). This replaces the previous story (diner incident → hardware store → trail → Patient Zero → seal the cooler). Acceptance IDs were renumbered; tests tagged with the old `@E19-ACxx` IDs must be re-tagged or retired (see §10).

## 1. Goal

A ~5-minute origin story. A young **courier** (male or female, cosmetic) and their **corgi** do a normal delivery on a normal morning in Sunset Grove. The delivery goes to a slightly suspicious lab annex; a contained accident inside releases **several** infected, and from then on the outbreak spreads **through the game systems, not scripts**: infected see, chase and bite pedestrians, bitten pedestrians turn (keeping their identity) and hunt in turn. The player kicks their way through a first fight, finds a **baseball bat in a garage**, feels briefly in control, then sees the outbreak grow beyond them and escapes to a temporary safe place.

Emotional outcome: *the job is done, and you caused something catastrophic.* End caption: **"Delivery complete. Outbreak: not contained."** The player ends alive, armed with the bat, ready for L2.

## 2. Depends on / Enables

E04 (controller), E05 (combat), E07 (infected AI), E08 (civilians, corgi), E09 (bicycle as a light vehicle), E10 (district D-GROVE), E11 (interactables), E12 (missions), E14 (HUD), E15 (VFX), E16 (audio), E26 (pushable props) / E20, M1 exit.

## 3. Level structure and story beats (~5 min)

Times are targets for a new human player who uses the bicycle; on foot add ~20 s. Only beats 1–5 are scripted; from beat 6 on, scripts only set objectives and the **director rules** in §5.9.

| # | Beat | Area | What happens | Target time |
| --- | --- | --- | --- | --- |
| 1 | Normal morning | Maple Corner (Sunset Grove Coffee patio) | Start next to the courier bicycle at the bike rack; dense pedestrian life (§5.1), café chatter, light traffic, birds. Dispatcher line (phone toast): *"Morning! One cold-chain parcel at the depot, goes to the Medical Annex on Larch Street. Easy one."* Objective: **Pick up the package at the courier depot**. Movement and bicycle prompts appear once. | 0:00–0:20 |
| 2 | Pickup | Sunset Grove Courier depot counter (Main Row) | Stand-to-interact at the counter (1.0 s; `E`/F/MMB instant). The clerk hands over a sealed cold-chain medical parcel; the courier carries it (in the bicycle's cargo box when riding, under the arm on foot). Objective: **Deliver the package to the Medical Annex**. | 0:20–0:50 |
| 3 | Ride to the facility | Juniper Lane → Larch Street | Free route through the residential loop. The facility reads as "slightly off": security fence, hazard and "Authorized personnel" signs, a humming rooftop vent, a flickering window, a parked unmarked van. The corgi slows near it and whines once. | 0:50–1:40 |
| 4 | Leave the bicycle, hand over | Sunset Grove Medical Annex forecourt | A **No bicycles** gate zone: the bicycle cannot enter; the player dismounts at the bike rack outside the gate (auto-dismount when riding into the zone) and walks ~8–10 m. Stand-to-interact at the door: the **lab technician** (a named NPC) comes out, signs, takes the box and walks back inside. Toast: **"Delivered ✓"**. The bicycle stays exactly where it was left for the rest of the level. | 1:40–1:55 |
| 5 | Brief calm → accident | forecourt | **4–6 s of nothing** (normal ambience, objective panel shows a completed tick, no new objective). Then the corgi stiffens and growls toward the building (≈ 1.5 s before the blast). Accident sequence (≈ 8 s, never a big cinematic, camera stays playable): lights flicker in the windows (0.0 s) → contained pressure blast: windows bow out, one shatters, glass and objects rattle, short camera shake (1.5 s) → muffled ringing / low-pass on the mix for 1.2 s → smoke from the vent and the broken window → screams and crashes inside. | 1:55–2:10 |
| 6 | Multiple infected escape | forecourt → all directions | At accident + 8–10 s, **5 infected** burst out through the front door, the side door and the broken window, **including the lab technician** who took the package (same model, same clothes, now transformed), and run in **different directions** (at least 3 distinct headings ≥ 60° apart). Objective: **Get away from the facility**. From here on the outbreak is systemic. | 2:10–2:30 |
| 7 | Panic and spread; first fight | Larch Street, Juniper Lane | Pedestrians notice, scream and flee; infected chase and bite them; victims transform and join. The player can fight 1–2 infected with unarmed kicks/strikes (never one-shot). Dispatcher: *"What was that bang? …Hey, are you okay? Get off the street — grab anything you can!"* Objective: **Find something to defend yourself** (soft marker on the open Henderson garage). | 2:30–3:15 |
| 8 | The bat | Henderson garage (Elm Street) | Walk into the half-open garage; stand-to-interact at the workbench / sports bag: **baseball bat** equipped (HUD swap, short power stinger, the courier spins it once). Checkpoint. Brief feeling of control: 1–2 infected come in range and go down to the bat in 2 hits each. | 3:15–3:45 |
| 9 | Beyond control | Elm Street / Main Row | On leaving the garage the player sees **a big group (≥ 6 infected) chasing pedestrians** down the street (systemic population, director ensures it — §5.9). Dispatcher: *"The fire station on Birch — they've got a shutter door. Go!"* Objective: **Reach the fire station**. Routes: main street (fast, crowded), back alleys (gates, dumpster), the car wash, or back to the bicycle (loop). | 3:45–4:45 |
| 10 | Temporary safety | Fire Station 3 bay | Reaching the bay trigger: the roll-down shutter closes behind the player and corgi (infected outside cannot pass). Interior quiet; through the gap the street is full of chaos; sirens in the distance. Caption: **"Delivery complete. Outbreak: not contained."** Result screen shows: delivery ✓, infected count, pedestrians turned, pedestrians who escaped, time. | 4:45–5:10 |

**Checkpoints:** after the accident starts (beat 6, snapshot taken at the moment the infected exit) and after the bat pickup (beat 8). On death the player respawns at the last checkpoint; the outbreak state (infected, civilians, bicycle position, gate/dumpster states) is restored from the snapshot.

**No fail timer.** Time pressure is systemic: the longer the player waits, the more infected exist (AC06).

## 4. Map — district `D-GROVE` (L1 only)

A new compact L1 district built with the existing layout tooling (`layouts/D-GROVE/layout.py` → `public/assets/layouts/D-GROVE*`). D-RES/D-MAIN stay unchanged for later levels.

- **Size:** walkable area ≈ 170 m (W–E) × 110 m (N–S). Running the main axis edge to edge at the player run speed (4.5 m/s) with no obstacles takes **30–45 s** (target 38 s).
- **Streets** are chibi-scale (≤ 5 m carriageway), sidewalks 2 m, lawns, driveways, alleys 2–3 m wide.

| Area | Position | Contents | Role |
| --- | --- | --- | --- |
| **Maple Corner** (start) | west | Sunset Grove Coffee, a brick corner café with an umbrella patio, bus stop, bike rack with the courier bicycle, crosswalk | start, life, sound of normal |
| **Main Row** | north-west → north | 3–4 storefronts (brick row), **Sunset Grove Courier depot** (pickup), parked courier van | pickup |
| **Juniper Lane loop** | centre | ring street with 8–12 houses (base types, §6), front yards, fences, hedges, driveways with cars | residential, loops |
| **Larch Street** | east | **Sunset Grove Medical Annex** lab/clinic annex behind a security fence, small forecourt, bike rack outside the gate, staff parking | delivery, outbreak origin |
| **Elm Street** | south-centre | **Henderson house with detached garage** (door half open, light on, workbench, sports bag with the bat) | first weapon |
| **Back alleys** | between blocks | gravel/asphalt alleys behind back yards, **2–3 yard gates**, **2 dumpsters** at alley necks, trash bins, privacy fences | optional routes, toys |
| **Sunny Suds car wash** | south-west, next to a small Sunset Fuel corner | drive-through car wash bay | toy, line-of-sight blocker |
| **Fire Station 3** | south-west (Birch Street) | bay with a roll-down shutter | safe endpoint |

**Route rules (layout-tested):**
- At least **two disjoint routes** between each consecutive pair of objectives (start→pickup, pickup→facility, facility→garage, garage→fire station).
- A **return loop**: from the garage or the fire-station approach there is a route back to the facility's bike rack that does not retrace the delivery path for more than 30 m.
- **Line-of-sight blockers** every ≤ 25 m along every route: buildings, parked cars, tall hedges (≥ 1.6 m), privacy fences, the car-wash bay. Low picket fences and lawns do **not** block sight.
- Narrow passages (≤ 2.5 m) at alley necks and yard gates, where gates/dumpsters can close them.
- Visible-geometry collision only (no invisible walls; map edges are visible fences, hedges, buildings, or a construction barrier).

## 5. Systems

All values live in data files (`src/data/*`), are deterministic per seed, and are the starting tuning.

### 5.1 Pedestrians (civilians)
- **Density:** 50–60 civilians in D-GROVE at level start (never children in the infection chain, E08), spread over all areas, groups of 1–3, no two identical model+tint combinations within one screen.
- **Routines** (from m1-civlife): sit on a bench/patio with coffee, walk a sidewalk loop with groceries or phone, elderly walk with cane and stop at flower boxes, water plants, chat in facing pairs with gestures, walk a dog, queue at the diner, jog. Nobody idles facing nowhere for > 3 s.
- **Notice → panic:** a civilian notices an infected within its own sight (140° cone, 16 m, line of sight) **or** hears a scream/blast within 12 m (civilians may hear; infected may not). Reaction: 0.3–0.8 s startle (drop what they carry, turn toward), then flee away from the threat toward the nearest **refuge door** (houses, shops) or off-map edge; entering a refuge removes them as "escaped".
- **Speeds:** walk 1.2–1.5 m/s, flee **3.2–4.0 m/s** — always slower than every infected tier (§5.4), so caught in the open eventually.
- **Bite:** an infected that reaches a civilian grabs and bites (1.0 s). The player can interrupt with any hit during the grab (rescue window 1.0 s). Otherwise the civilian **turns** (§5.7) in **3.0 ± 0.5 s** and joins the infected population.

### 5.2 Infected perception (vision only)
- Forward vision cone **90°** (±45°), range **16 m**, blocked by line-of-sight colliders (buildings, cars, tall hedges, privacy fences, closed gates, car-wash curtain while active).
- **Targets:** player and civilians are equivalent humans. The corgi is never a target.
- **Target choice:** the **closest currently visible human** (re-evaluated every 0.25 s with a 1.5 m switch hysteresis). Leading a chaser past a closer pedestrian makes it switch — intended.
- **No hearing of the player** in L1: footsteps, attacks, hits and the bicycle create no noise events for infected.

### 5.3 Infected states and priority
`wander → chase → (lose sight) search → wander`, plus `attracted` for deliberate loud events.
- **Priority:** visible human > deliberate distraction (car alarm) > wander.
- **Wander:** slow drift (1.0–1.4 m/s) between nearby nav points with random pauses and head turns.
- **Chase:** run at the tier speed toward the target; lunge at ≤ 2.5 m (runner lunge).
- **Search:** on losing sight, the infected searches for a **random 10–18 s** (uniform per episode, seeded): it moves to the last-known position, then visits 3–6 random nearby probe points within 4–12 m (biased toward the target's last heading and toward cover edges), changes direction, looks around (head sweeps), and **doubles back** at least once with probability ≥ 0.35. Any human seen ends the search. After the timer it returns to wander.
- **Attracted (car alarm):** infected within **30 m** of a sounding car alarm (sound passes walls) and not chasing switch to `attracted`: move to a random point within 3 m of the car, then search around it (same search behaviour, centred on the car) for the alarm duration (20 s) + 4–8 s. Seeing a human interrupts it.
- **Herd cue (PO request 2026-10-07):** an infected that sees (cone + line of sight) another infected chasing or biting immediately turns toward that attacker's running direction (~0.3 s) and looks again; if a human is now visible it targets the closest visible human as usual and attacks, otherwise it follows the attacker's heading for 2–3 s, then searches/wanders. Sight only (the cue is a visible attacker); chains propagate naturally. A car-alarm attraction is only overridden when the cue reveals a human.

### 5.4 Infected speed tiers
Speed = tier base × individual jitter (uniform ±4 %, seeded per entity, fixed for its life; orchestrator decision 2026-10-06 — was ±6 %, which let slow 'average' infected take ~34 s to close 10 m). Player run = 4.5 m/s.

| Tier | Who (visual read) | Base run m/s | Readable cue |
| --- | --- | --- | --- |
| frail | elderly civilians, bathrobe neighbour | 4.7 | stiff hunched shuffle-run, short stride |
| average | adult civilians, lab staff, workers | 5.3 | lurching run, arms forward |
| athletic | joggers, young adults, skater | 5.6 | long low sprint stride, aggressive lean |

Every tier is faster than the running player (min frail × 0.96 = 4.51 > 4.5; every average infected closes 10 m in ≤ ~17 s). Crawlers are not used in L1 v2.

### 5.5 Player movement
- **Running is the default** (4.5 m/s, current base speed). **Hold Walk** to walk at 2.0 m/s (careful positioning, roleplay). Bindings in `00-game-concept.md` §5.3.
- No stamina in L1.

### 5.6 Combat difficulty (L1)
- Infected HP 40 (all L1 tiers). Infected hit: 10 damage, 0.9 s attack cycle. Player HP 100, regen as §4 of the concept.
- **Unarmed** (7-move style, 00 §5.3): 9–11 damage per hit, so **4–5 hits** per infected, kicks with knockback 1.5–2.5 m and 0.4 s stagger. **No unarmed hit ever kills or disables at full HP.**
- **Baseball bat:** 22 damage, combo finisher 30 → **2 hits** per infected; knockback 2.5–3.5 m.
- Intended lesson: 1–2 infected are beatable unarmed; 4+ at once kill a player who stands and fights.

### 5.7 Infection continuity (pedestrian → infected)
The infected keeps the **same entity id, model, clothing, tint and accessories** (minus carried hand props, which drop). The transformation, ≈ 3 s, is readable at the game camera:
1. bite reaction stagger (0.5 s), clutches the wound;
2. collapse to knees → ground, convulsions (1.5–2.0 s), skin tint blends 0 → 40 % toward ash-green, veins/bruising decal appears at the bite;
3. eyes start glowing red in the last 0.7 s; blood around the mouth and bite;
4. rises with the infected posture (hunch, head tilt, arms forward) and the infected locomotion set of its speed tier; small sound + VFX puff.
No model swap is visible (any swap happens hidden inside the collapse, and the swapped model is the same mesh with the infected overlay).

### 5.8 Corgi
Follows the player (existing companion), cannot die, no health bar, never targeted by infected or civilians, never attacks or deals damage, not commanded. **Warnings** (no UI text): when an infected not visible on screen (or behind cover) is within 20 m: stop + stiffen + look toward it; within 14 m: growl; within 9 m or approaching fast: bark (rate-limited 1/2 s); afterwards a nervous idle (tail low, glances around) for 6 s. Before the accident it reacts to the facility (whine at beat 3, stiffen+growl at beat 5).

### 5.9 Outbreak director (non-scripted guarantees)
The director never places infected in view (M1-10 spawn rule still applies: off-frustum + 10 % margin or fully occluded at doors/alleys). It may only:
- top up the civilian population off-screen (walkers entering from map edges) while fewer than 25 civilians remain, until 3:30 into the outbreak;
- before beat 9, if fewer than 6 infected are within 35 m of the garage exit, steer existing infected (choose wander targets) and, if still short, spawn off-screen infected *pedestrian victims* (civilian models with the infected overlay) coming down Elm Street chasing fleeing civilians.
- **Caps:** concurrent infected ≤ 60 (high tier) / 30 (low tier, mobile); at the cap a bite kills the civilian instead of turning them.

### 5.10 Bicycle
- Courier cargo bicycle (`veh.courier-bike`) at the start bike rack. Mount/dismount by stand-to-interact 0.4 s or `E`/F/MMB/ACTION instantly.
- Speed **7.5 m/s** (faster than every infected tier), acceleration 0→7 m/s in 1.5 s, wider turning (min radius 2.5 m), collides like the player (no pass-through), stops on obstacles.
- **Harmless:** no damage, no knockback, no run-over; colliding with an infected stops the bike and dismounts the player.
- Infected treat a riding player like any human (vision, chase).
- While riding, attacks are disabled; the corgi runs alongside (speed cap raised to 7.5 m/s for the corgi only while the player rides).
- **No-bicycle zones:** the facility forecourt and building interiors (garage, fire-station bay): riding into one auto-dismounts at the edge.
- Persistence: the bicycle stays exactly where dismounted (saved in checkpoint snapshots) and is never moved by scripts.

### 5.11 Interactive toys (optional)
Each one: stand-to-interact or `E`/F/MMB/ACTION, immediate readable effect, no inventory.
| Toy | Count | Effect |
| --- | --- | --- |
| **Yard gate** | 3 (alleys/yards) | close/open (0.4 s swing). Closed gates block movement and line of sight for humans and infected; infected must route around (they do not break gates in L1). |
| **Dumpster push** | 2 (alley necks) | the player pushes it 2–3 m along a rail into the passage, blocking it (movement; not sight). |
| **Car alarm** | 4 parked cars (marked by a blinking dashboard LED) | interact or kick → alarm 20 s (lights flash, horn loop): attraction point (§5.3). Each car re-armable after 30 s. |
| **Car wash** | 1 | start the wash (15 s): brushes spin, foam/water curtain blocks line of sight through the bay; infected inside move at 50 %. |

### 5.12 Sound arc (E16)
- **Before the accident:** café chatter, people talking, light traffic, bicycle bell/freewheel ticks, birds, light morning music bed (calm).
- **Accident:** flicker buzz, pressure blast (muffled "thoomp", glass rattle), 1.2 s ringing with low-pass on the mix, screams, crashes, alarm bell in the facility.
- **After:** a chaos layer whose intensity follows the infected count (0 → 30+): screams, infected vocal barks/groans, running footsteps, car alarms, falling objects, distant panic and sirens; tense music. Calm-layer volume drops ≥ 12 dB within 3 s of the blast.
- In the fire station: muffled exterior, the caption, a short outro sting.

## 6. Production philosophy (assets)

- **Base houses:** 5 reusable types (`bld.house-a/b/c` existing + 2 new), each varied by colour palette, mirror/rotation, driveway car (or none), garage door (open/closed/none), garden set and vegetation. Base houses are side tier.
- **Unique hero locations** get full detail: Sunset Grove Courier depot (pickup), Sunset Grove Medical Annex (delivery, with accident states), Henderson garage (bat), Fire Station 3 (safe endpoint; existing `bld.fire-station` plus a working shutter), Sunset Grove Coffee (start, `bld.cafe-corner`). Asset ids already in production from the concept sheet `initial-drafts/l1v2-key-locations.png`: `bld.clinic-annex`, `bld.garage-detached`, `bld.cafe-corner`, `veh.courier-bike`, `prop.package-courier`, courier outfit (`char.courier-female/male`).
- Full list and visual descriptions: `epics-pipeline/l1v2-assets.md`.

## 7. Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md):
- [`World/PoleLights.js`](../folio-2025/sources/Game/World/PoleLights.js): morning street life lights
- [`Objects.js`](../folio-2025/sources/Game/Objects.js): pushable dumpster, kickable props
- [`Physics/PhysicsVehicle.js`](../folio-2025/sources/Game/Physics/PhysicsVehicle.js): bicycle feel (as a light kinematic vehicle)
- [`View.js`](../folio-2025/sources/Game/View.js): accident shake and the end caption

## 8. Photo spots (vision review)
`l1-morning` (café patio, bicycle, ≥ 8 pedestrians in frame), `l1-pickup`, `l1-facility` (before), `l1-accident` (smoke + broken window), `l1-escape` (≥ 4 infected running off in different directions), `l1-spread` (a pedestrian mid-transformation), `l1-garage` (bat pickup), `l1-horde` (≥ 6 infected on Elm Street), `l1-safe` (fire-station bay with caption).

## 9. Acceptance criteria

Bots: `complete` (uses the bicycle, the shortest route), `newbie` (handicapped profile, `90-test-concept.md` §5, on foot), `idle` (player stands at the facility forecourt after delivery and never moves), `evade-only` (never attacks). "Real-input e2e" = headless Playwright (`headless: true`, WebGL2, through `tools/e2e-lock.sh`) driving the game only with mouse/keyboard events, no debug teleports.

| ID | Criterion | Verification |
| --- | --- | --- |
| E19-AC01 | The L1 mission graph (start → pickup → deliver → escape → find weapon → reach fire station) is structurally completable (E12-AC07 walk) and has no fail timer | sim |
| E19-AC02 | The `complete` bot finishes L1 on **20/20 seeds** without cheats; median sim time **4:00–6:00** | sim |
| E19-AC03 | The `newbie` bot finishes on ≥ 18/20 seeds with median sim time **4:30–7:00** and median deaths ≤ 1 | sim |
| E19-AC04 | D-GROVE layout: crossing the main W–E axis at 4.5 m/s takes 30–45 s; each consecutive objective pair has ≥ 2 routes that share < 30 % of their length; a return route from the garage to the facility bike rack exists; every route has a sight-blocking collider within every 25 m; no invisible walls (every edge collider has visible geometry) | sim (layout test) |
| E19-AC05 | Pedestrians: 50–60 civilians at start; none idle facing nowhere > 3 s over 60 s; on noticing an infected they startle (0.3–0.8 s) and flee; their flee speed is < the slowest spawned infected speed on 20/20 seeds | sim |
| E19-AC06 | **Systemic spread:** with the `idle` bot, infected count rises from 5 at the escape to **≥ 15 at +120 s** and **≥ 25 at +240 s** (median over 20 seeds; ≥ 18/20 seeds reach ≥ 12 at +120 s), with every new infected caused by a bite event (no director spawns while the player is idle at the forecourt and the garage beat is not reached) | sim |
| E19-AC07 | **Robust start:** the accident releases exactly 5 infected through ≥ 2 exits with ≥ 3 headings ≥ 60° apart, one of them the technician entity that took the package (same entity id/asset); if the player kills any one of them within 5 s, at least one bite still happens within 60 s on 20/20 seeds | sim |
| E19-AC08 | **Vision:** an infected detects a human only inside its 90° cone, ≤ 16 m, with clear line of sight (table test over angles/occluders, incl. closed gates and the active car-wash curtain); the player's footsteps, attacks and bicycle create no infected perception events | sim |
| E19-AC09 | **Closest visible target:** when a visible pedestrian is ≥ 1.5 m closer than the chased player, the infected switches to the pedestrian within 0.5 s (and back after the bite) | sim |
| E19-AC10 | **Search:** after losing sight, search durations over 200 episodes are within 10–18 s with a spread (std ≥ 1.8 s); the search visits ≥ 3 distinct probe points, ≥ 35 % of episodes include a double-back; no search ends at the exact last-known position; afterwards the infected wanders | sim |
| E19-AC11 | **Car alarm:** a triggered alarm pulls every non-chasing infected within 30 m to within 4 m of the car within 12 s; a visible human overrides the attraction; the alarm stops after 20 s and re-arms after 30 s | sim |
| E19-AC25 | **Herd cue** (PO request 2026-10-07): an infected facing away from the player that sees a chasing infected turns to its heading and acquires the player within 0.6 s when the player is then in its cone with clear line of sight; with that line of sight blocked it does not acquire and follows the heading instead (20 seeds) | sim |
| E19-AC12 | **Speeds:** every L1 infected tier is faster than the running player (frail ≥ 4.5 m/s for ≥ 95 % of spawns), tiers are ordered frail < average < athletic, two infected of the same tier differ by ≥ 1 % on 20/20 seeds (no synchronized group); in a straight-line chase the average-tier infected closes 10 m in ≤ 20 s | sim |
| E19-AC13 | **Movement default:** with no modifier the player moves at run speed (4.5 m/s) on keyboard, click-to-move and touch; holding Walk (keyboard `C`/`Alt`, mouse `Alt`+click, touch stick < 50 % deflection) moves at 2.0 m/s; releasing returns to run within 0.2 s | sim + real-input e2e |
| E19-AC14 | **Combat difficulty:** no unarmed hit kills a full-HP infected; unarmed needs 4–5 hits, the bat 2; the `newbie` duel bot beats 1 infected unarmed on ≥ 19/20 seeds and 2 on ≥ 14/20; a player standing and fighting 5 infected unarmed dies within 20 s on ≥ 18/20 seeds | sim |
| E19-AC15 | **Bat in the garage:** the bat is acquired only by interacting inside the Henderson garage; the HUD switches to the bat; no weapon pickups exist on open streets in L1; the player starts with an empty (unarmed) loadout | sim + real-input e2e |
| E19-AC16 | **Bicycle:** mount/dismount works by interaction; speed 7.5 m/s > every infected tier; colliding with an infected deals 0 damage and dismounts; riding into the facility forecourt auto-dismounts at the edge; the bicycle position after dismount is unchanged at level end and after a checkpoint restore; L1 is completable without ever mounting it (`newbie` on foot) | sim |
| E19-AC17 | **Corgi:** never takes damage, has no HP bar, is never selected as a target by infected or civilians over full `complete` runs (20 seeds), never deals damage; emits stiffen/growl/bark warning events toward an off-screen infected at the distances of §5.8 before that infected is on screen in ≥ 80 % of first encounters | sim |
| E19-AC18 | **Infection continuity:** a bitten civilian keeps its entity id, asset id, tint and accessory set; the transformation takes 2.5–3.5 s, passes the stagger → collapse → glowing eyes → rise phases (state log), and the result uses its speed tier from §5.4 | sim |
| E19-AC19 | **Accident beat:** after "Delivered ✓" there is a 4–6 s window with no new objective and no infected; then flicker → blast → ringing → smoke → screams events fire in order within 8 s; the blast has no frame > 50 ms (no hitch, M1-22) | sim + real-input e2e (perf trace) |
| E19-AC20 | **Toys:** each yard gate blocks movement and sight when closed (infected route around); each dumpster push closes its passage for infected pathing; the car wash curtain blocks sight for 15 s; all toys are optional (the `complete` bot uses none) | sim |
| E19-AC21 | **Sound arc:** pre-accident only calm-layer cues play; the blast triggers the ringing/low-pass and the calm layer drops ≥ 12 dB within 3 s; the chaos layer intensity correlates with the infected count (Spearman ρ ≥ 0.7 over a run) | sim (audio event log) |
| E19-AC22 | **Real-input playthrough:** headless Playwright drives L1 with real mouse/keyboard input only (click-to-move, interactions via `E`, Shift-attack, the bicycle) from title to the result screen on 1 seed; 0 console errors; screenshots at all 9 photo spots (§8); the end caption text matches exactly | real-input e2e |
| E19-AC23 | **Visual review** (Opus vision against the mockup, checklists §7.1/§7.4 + this list): `l1-morning` reads as a normal living suburb; `l1-facility` reads as slightly suspicious; `l1-accident` shows contained (not cinematic) damage; `l1-spread` shows the same person mid-transformation; `l1-horde` reads "too many — run". Each scores ≥ 7/10 and has no P0/P1 findings | vision |
| E19-AC24 | **Performance:** high tier holds the E18 budget at `l1-morning` (60 civilians), `l1-accident` and `l1-horde` (≥ 30 infected + civilians); no frame > 50 ms on any objective transition | perf |

## 10. Notes for implementers
- Old tests tagged `@E19-AC01/04/05/06` (diner slice) must be re-tagged to the new IDs or removed together with the slice (`src/levels/levelOneSlice.ts`); `@E19` epic tags on render/look tests stay valid.
- The previous Patient-Zero boss, cooler sealing, hardware-store weapon choice and kick-a-cone tutorial are out of L1 (assets stay for later levels).
- Campaign unlock after L1: the **baseball bat** (crowbar and machete stay findable in later levels).
