# E20 · Level 2: The Failed Rescue

> **Rewritten 2026-10-07 per product owner** (`po-levels-2-6-2026-10-07.md`, which wins on any disagreement). This replaces the previous L2 "Get Them Out" (brother, Mrs. Alvarez, school, baseball-field buses). Old `@E20-ACxx` tags (none exist yet) must not be reused for the old design. The old L2 mission case in `src/levels/missions.ts` is superseded; its systems (escort, defend, gates, radio, checkpoints) are reused.

## 1. Goal

A ~5-minute level that starts **inside Fire Station 3 a few hours after L1**, at midday. For 20–30 s organized help still seems to exist: firefighters, radio chatter, frightened civilians. Then the station alarm sounds, the player optionally grabs a **fire axe**, and rides out with **six firefighters** in the fire truck to free **~30 civilians trapped in a building**. The moment the doors open and the civilians stream out, **infected pour in from the surrounding streets**. The rescue collapses into a systemic outbreak (L1 rules), firefighters fight, get bitten and turn. A radio call sends the player through wounded-but-standing streets to the **police checkpoint at the river bridge**; the gate closes behind them.

Emotional outcome / lesson: **"You can kill zombies. You cannot kill the outbreak."** The axe makes the player stronger than in L1, but the outbreak grows faster than the player's power. The intended play is *fight a little → retreat → break away → kill the few that follow → keep escaping*. Escalation arc position: **emergency services respond, and fail.**

## 2. Depends on / Enables

E19 (L1 outbreak systems: perception, search, herd cue, emergence, infection continuity, director caps), E05/E06 (fire axe roundhouse, §5.3), E07, E08 (civilians, corgi), E09 (fire engine as a passenger vehicle), E10 (districts, W1 layer), E11 (doors, car alarms), E12 (mission graph), E14, E15, E16, E25 (midday preset, alarm beacons, police light bars), E26 (gate, dumpsters), E27 (one smoking vehicle) / **E21** (starts at the checkpoint this level ends at), M2.

## 3. Scope

**In:** the Fire Station 3 interior bay (calm beat, alarm, axe rack, boarding); the fire-truck ride (passenger, kinematic route); the rescue site (trapped civilians, door forcing, the emergence ambush); **allied fighters v1** (firefighters as infectable armed pedestrians, §5.2); the radio objective change; the street escape with spread-out infected, a dense cluster and distractions; the police bridge checkpoint with a closing gate; the W1 damage layer; the `L2` midday lighting preset; photo spots, bots, and tests.

**Out:** player driving (the truck is a ride; orchestrator default — PO may change); firearms (L3); special infected archetypes (Brute, Screamer etc. are not scheduled in L2; the infected are turned humans with L1 speed tiers — orchestrator default); escorts with a fail state; upgrade/reward screens (PO 2026-10-07: none between levels).

## 4. Level structure and story beats (~5 min)

Times are human pacing targets. Scripts drive beats 1–5 and the end gate; everything after the doors open is systemic (§5.1, the E19 §5.9 director rules).

| # | Beat | Location (district) | What happens | Target time |
| --- | --- | --- | --- | --- |
| 1 | Organized help | Fire Station 3 bay interior (`D-GROVE`, Birch Street) | Player starts in the bay where L1 ended, bat in hand, corgi beside them. 6 named firefighters check gear, wash the truck, eat; radio chatter (dispatch traffic about incidents across town); 3–5 frightened or lightly injured civilians sit on benches with blankets. Free walk, **no combat, no infected anywhere in the district**. A captain line: *"Grab some water. You're safe here — for now."* | 0:00–0:25 (alarm at 20–30 s, seeded) |
| 2 | The call | station bay | Alarm: red rotating beacons start, station bell and siren sound, dispatcher: *"Engine 3, trapped civilians at Grove Market, thirty-plus, building secured from inside — go!"* The firefighters run to the truck within 2 s. Objective: **Get on the fire truck**. Optional soft marker: **fire axe** on the wall rack (stand-to-interact 0.6 s / `E`). | 0:25–0:45 |
| 3 | Ride out | Birch Street → Main Row → Grove Market lot (`D-GROVE` → `D-SHOP`) | Player boards at the crew door (stand-to-interact 0.6 s). The truck drives a fixed kinematic route (15–25 s), siren on, camera follows at the normal isometric angle with 15 % zoom-out; the player cannot act (passenger) but sees early W1 damage pass by. | 0:45–1:10 |
| 4 | Arrival and doors | Grove Market forecourt (`D-SHOP`, `bld.supermarket`) | Truck stops; everyone exits; **player control returns within 0.5 s**. No infected in the rescue area. Firefighters jog to the chained front doors and the side loading door, force them (4 s halligan/cutter animation). Civilians are visible behind the glass, banging and waving. | 1:10–1:30 |
| 5 | Success → collapse | forecourt, parking lot, surrounding streets | **Doors open → ~30 civilians start streaming out → at that exact moment infected emerge** from the surrounding street edges and building doors (≥ 3 directions). Civilians panic and scatter; firefighters fight; bites, turns, snowball. The player can help (rescue windows) or not. | 1:30–2:15 |
| 6 | New objective | rescue site | Radio: *"All units, fall back. Evacuation point is the police checkpoint at the river bridge. Anyone who can move — go!"* Objective: **Reach the police checkpoint at the bridge**. Fires at doors-open + 45 s or when the player is ≥ 25 m from the doors, whichever comes first. | 2:15–2:30 |
| 7 | Escape through streets | `D-SHOP` → `D-MAIN` / `D-RES` streets | Many infected spread over the map in groups of 1–6 that do **not** know where the player is (sight-only). Use line of sight, run, fight isolated ones, use car alarms and dumpsters, keep moving. A few fleeing civilians on the way. | 2:30–4:15 |
| 8 | The cluster | bridge approach (`D-EDGE`) | A dense cluster blocks the obvious main-road route to the bridge. Openings: a side alley / riverside path, a car alarm to pull them, a gap between wrecks. Clearing it is not required. | 4:15–4:45 |
| 9 | The checkpoint | Sunset River bridge, west bridgehead (`D-EDGE`, `bld.river-bridge` + `kit.police-bridge-checkpoint`) | Police vehicles with light bars, jersey barriers and crowd fences, officers waving the player in (and shooting infected that come within 15 m of the gate), civilians behind the line. The player crosses the gate line; **the gate closes behind them**; infected slam into it. No caption card, no reward screen: the camera holds 2 s and **L3 loads at this exact checkpoint**. | 4:45–5:00 |

**Checkpoints:** `doors` (snapshot at doors-open, including the outbreak layer), `escape` (when the bridge objective starts), `cluster` (entering the bridge approach). Respawn restores the snapshot (E19 rules).

**No fail timer.** The pressure is the systemic spread.

## 5. Systems

All values live in data (`src/data/l2.ts` or equivalent), are seeded and deterministic, and are starting tuning.

### 5.1 Outbreak rules carried over from L1 (apply to L2–L6 unless a level epic says otherwise)
- **Perception: sight only** (E19 §5.2): 90° cone, 16 m, line of sight; the closest visible human is the target (player, civilian, firefighter, police, soldier, survivor are all humans); 10–18 s search on losing sight, then wander; **herd cue** (E19 §5.3); no hearing of footsteps or melee.
- **No omniscient infected:** no system may hand an infected the player's live position. Director-added infected **emerge from doors / street edges** out of view (E19 §5.9) and then wander or follow what they see. Loud events (car alarms; from L3 gunshots, E21 §5.3) attract to the **event position**, never to a tracked target.
- **Bites turn humans** in 3.0 ± 0.5 s with full identity continuity (E19 §5.7): firefighters keep their turnout gear and helmet, police their uniforms, soldiers their fatigues. At the concurrency cap a bite kills instead of turning.
- **Speed tiers** frail/average/athletic as E19 §5.4 (every tier faster than the running player). Infected HP 40 (orchestrator default for all turned humans in L2–L6; PO may change).
- **Snowballing is emergent:** the director never scripts deaths or turns after the set-piece trigger.
- **Corgi:** follows with the L1 rules (E19 §5.8: warns only, immune, never targeted) in every level, rides along in vehicles (orchestrator default — the PO text does not mention the corgi after L1; PO may change).
- **Health:** each level starts at full health; medkits exist only where a level epic places them (L3). Weapons carry over between levels.

### 5.2 Allied fighters v1: firefighters
A reusable NPC role (`ally` faction) used by firefighters (L2), police (E21), soldiers and armed civilians (E22):
- Perceive infected with the same sight model as civilians (140° cone, 16 m, LOS); engage visible infected within their weapon range; otherwise move toward their scripted task or regroup point.
- **Firefighters (6):** HP 100, melee only (axes, halligan bars: 25 damage, 0.8 s swing, 1.8 m reach); they prioritize infected grabbing a civilian (rescue window 1.0 s, as the player's).
- **Not protected:** allies have no invulnerability, no damage immunity and no scripted survival. An infected can grab and bite them like any human; they turn (§5.1) and hunt.
- Player weapons never damage allies or civilians (E08 pass-through rule); allies never damage humans (orchestrator default).

### 5.3 Fire axe (E06 rule, introduced here)
- Optional pickup on the station wall rack; added to the carried-weapon cycle and auto-equipped.
- **Single swing:** when fewer than 3 infected are within 2.5 m, a normal frontal swing: 45 damage (one hit kills a 40 HP infected), 100° arc, 2.1 m reach, 0.75 s swing (slower than the bat).
- **Automatic roundhouse:** when **≥ 3 infected are within 2.5 m** at swing start (orchestrator default for "surrounded"; PO may change), the same input plays a 360° roundhouse: 25 damage to every infected within 2.5 m, knockback 2.0–3.0 m and a 0.8 s stagger, 1.0 s total. It creates space; it does not wipe the crowd.
- No noise events (melee, as L1). The bat remains carried and selectable.

### 5.4 Rescue set piece
- **Trapped civilians:** 30 (high tier; 20 on low, orchestrator default) inside `bld.supermarket`, visible behind the glass doors before release. They are ordinary civilians (E08 states, flee speeds 3.2–4.0 m/s) and exit through the front and loading doors over ≤ 12 s, then flee toward refuges and the map edges away from threats.
- **Ambush:** the ambush group (10 infected, orchestrator default) waits hidden at ≥ 3 emergence points (street edges and building doors 25–45 m from the forecourt, outside the camera frustum). Their reveal is keyed to the `l2.doorsOpen` event, not a timer.
- **Worst case** (player idle): ~30 turned civilians + 6 turned firefighters + the ambush group, capped by the level cap.

### 5.5 Street escape
- **Route:** 220–300 m from the rescue site to the bridge gate, ≥ 2 disjoint routes, sight blockers every ≤ 25 m (E19 route rules).
- **Population:** 25–35 pre-placed wandering infected along the routes (groups of 1–6, ≥ 3 groups of ≥ 4), 8–12 fleeing/hiding civilians, infected from the rescue site that saw the player.
- **Distractions:** ≥ 3 car alarms (E19 §5.11 rules), ≥ 2 pushable dumpsters at alley necks.
- **Cluster:** 12–16 infected wandering in a ≤ 15 m radius on the main-road approach to the bridge; ≥ 2 openings (a side path that bypasses it, a car alarm within 20 m of it).
- **Caps:** concurrent infected ≤ 60 (high) / 30 (low).

### 5.6 Bridge checkpoint and transition
- Composition: ≥ 3 police vehicles with active light bars, jersey barriers + crowd fences, a motorized gate, ≥ 4 officers (allied fighters with handguns, holding position; they shoot infected within 15 m of the gate), ≥ 8 civilians behind the line.
- The officers never leave the line and are not followers (that starts in L3).
- Gate closes within 1.5 s after the player crosses the gate line; infected cannot pass a closed gate. `level.completed` fires; the campaign continues directly into L3 at this checkpoint (loadout carries over: bat + axe if taken).

### 5.7 Environment: W1 "wounded, but still standing"
Dressing layer over D-SHOP / D-MAIN / D-RES / D-EDGE: ≥ 6 corpses, ≥ 8 abandoned vehicles (≥ 3 crashed into poles/each other), ≥ 10 knocked-over bins, ≥ 6 scattered-belongings sets, ≥ 4 broken shop/house windows, **exactly 1** smoking vehicle (E27 small smoke column), ≥ 4 blood trails, ≥ 2 police/emergency vehicles with lights on, small signs of fighting (dropped baton, shell casings). **None** of: burned facades, collapsed buildings, building fires, rubble piles.

### 5.8 Lighting, sound
- Preset `L2` (midday): sun elevation clearly higher than `L1` (polar ≤ 0.40 rad vs L1 0.78), harder white light, shorter, harder shadows, sky bluer than L1.
- Station alarm: rotating red beacons (E25 `rotate` behavior) and the bell; the truck light bar and siren during the ride; police light bars at the checkpoint.
- Sound arc: calm station (radio chatter, kitchen, idle engine) → alarm → siren ride → hopeful murmur at the doors → chaos layer (E19 §5.12) → muffled outside after the gate closes.

## 6. Photo spots
`l2-station-calm` (bay, firefighters, civilians on benches), `l2-alarm` (red beacons sweeping), `l2-truck-ride`, `l2-doors-open` (two frames: doors-open +0 s and +5 s, same camera), `l2-collapse` (civilians fleeing, firefighter fighting, a turn in progress), `l2-streets-w1` (same camera as an L1 spot on Main Row), `l2-cluster`, `l2-bridge-checkpoint`.

## 7. Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md):
- [`World/VisualVehicle.js`](../folio-2025/sources/Game/World/VisualVehicle.js): fire-truck and police light bars, blinkers
- [`World/PoleLights.js`](../folio-2025/sources/Game/World/PoleLights.js): station beacons (rotate behavior)
- [`Objects.js`](../folio-2025/sources/Game/Objects.js): dumpsters, bins knocked over
- [`View.js`](../folio-2025/sources/Game/View.js): ride camera follow, zoom-out

## 8. Acceptance criteria

Bots: `complete` (takes the axe, shortest safe route), `newbie` (`90-test-concept.md` §5 handicaps), `no-axe` (`complete` but skips the axe), `aggressive` (stays at the rescue site and fights), `idle` (stands next to the truck after arrival). "Real-input e2e" as in E19 §9.

Time bands are **provisional** (scripted content alone is ~60–75 s: calm 20–30 s, ride 15–25 s, doors ~15 s). They are recalibrated against the first green 20-seed run per staging decision §6 (record the measured medians here, never pad).

| ID | Criterion | Verification |
| --- | --- | --- |
| E20-AC01 | The L2 mission graph (calm → board → doors → reach bridge checkpoint) is structurally completable (E12-AC07 walk) and has no fail timer | sim |
| E20-AC02 | The `complete` bot finishes L2 on **20/20 seeds** from the `L2-default` progression (bat carried) without cheats; median sim time **1:45–3:30** | sim |
| E20-AC03 | The `newbie` bot finishes on ≥ 18/20 seeds, median sim time **2:00–4:00**, median deaths ≤ 1; the `no-axe` bot finishes on ≥ 18/20 (the axe is optional) | sim |
| E20-AC04 | **Calm beat:** from level start until the alarm, zero infected entities exist in the level and zero `combat.*` events fire; the alarm fires at 20–30 s (seeded); firefighters reach the truck within 8 s of the alarm and the axe rack is interactable | sim |
| E20-AC05 | **Ride:** boarding by interaction emits `vehicle.entered{role:'passenger'}`; the truck follows its route in 15–25 s with the player and 6 firefighters seated (seat nodes), player input moves nothing while seated; on arrival all 7 exit within 4 s and player control returns within 0.5 s of `l2.truckArrived` | sim |
| E20-AC06 | **Set-piece order and timing:** events fire in the order `l2.truckArrived` → `l2.crewExit` → `l2.firefightersAtDoors` → `l2.doorsOpen`; no infected is within 40 m of the forecourt before `l2.doorsOpen`; the first civilian crosses the threshold ≤ 1.0 s after it; the first ambush infected becomes visible (in frustum) **≤ 0.5 s after `l2.doorsOpen`**; ≥ 8 infected emerge from ≥ 3 distinct emergence points ≥ 60° apart (bearing from the doors) within 3 s; all trapped civilians are outside within 12 s (20 seeds) | sim |
| E20-AC07 | **Snowball:** with the `idle` bot, the infected count rises from the ambush size to **≥ 20 at doors-open + 60 s** and **≥ 30 at + 120 s** (median of 20 seeds, capped at the level cap), with every new infected after the reveal caused by a bite event (no director spawns at the rescue site) | sim |
| E20-AC08 | **Firefighters are infectable allies:** each firefighter fights (≥ 1 `combat.hit` by firefighters per run in ≥ 18/20 seeds); a bitten firefighter keeps entity id, asset id and gear and turns in 2.5–3.5 s; with the `idle` bot ≥ 2 firefighters have turned by doors-open + 90 s on ≥ 15/20 seeds; no firefighter has a damage-immunity or scripted-survival flag at any tick | sim |
| E20-AC09 | **Lesson:** the `aggressive` bot (axe, stays within 15 m of the doors) kills ≥ 10 infected yet the live infected count at doors-open + 90 s is ≥ its value at + 10 s on ≥ 16/20 seeds, and it reaches 0 HP at least once within 120 s on ≥ 16/20 seeds; the `complete` bot (disengages) has median deaths ≤ 1 | sim |
| E20-AC10 | **Axe roundhouse:** with 1 or 2 infected within 2.5 m the axe swing is `style:'single'` (hits only within the 100° arc, 45 damage, a 40 HP infected dies in 1 hit); with ≥ 3 within 2.5 m the same input produces `style:'roundhouse'`, hits every infected within 2.5 m in 360° (≥ 3 `combat.hit`), and pushes each ≥ 2.0 m away; the bat still needs 2 hits (table test, 20 seeds) | sim |
| E20-AC11 | **Outbreak rules carried over:** L2 uses the E19 perception config (90° / 16 m / LOS, closest visible human, 10–18 s search, herd cue); **omniscience audit** over 20 `complete` runs: every infected `ai.target` event on the player has a clear sight line at that tick, every director-added infected first appears within 3 m of an emergence point outside the frustum, and melee/footsteps create no infected perception events | sim |
| E20-AC12 | **Escape population:** when the bridge objective starts, ≥ 25 infected are distributed over the escape area with ≥ 3 groups of ≥ 4, and ≤ 20 % of them are in `chase` on the player at that tick; ≥ 3 car alarms and ≥ 2 dumpsters exist on the routes; the layout test confirms ≥ 2 disjoint routes (shared length < 30 %) and sight blockers every ≤ 25 m | sim (layout + sim) |
| E20-AC13 | **Cluster:** 12–16 infected occupy the main-road bridge approach when the `cluster` checkpoint is reached; the `complete` bot passes it killing ≤ 50 % of the cluster on ≥ 18/20 seeds; both openings (side path, car alarm) are individually sufficient in forced-choice bot runs | sim |
| E20-AC14 | **Checkpoint and transition:** the checkpoint has ≥ 3 police vehicles with active light bars, ≥ 4 officers, ≥ 8 civilians behind the line and a gate; the gate closes ≤ 1.5 s after the player crosses the gate line, no infected crosses it afterwards (20 seeds), and the campaign loads L3 at the same checkpoint with the carried loadout, with no reward screen in between | sim + e2e |
| E20-AC15 | **W1 dressing:** the static dressing manifest for L2 contains the §5.7 minimum counts (corpses ≥ 6, abandoned vehicles ≥ 8 incl. ≥ 3 crashed, bins ≥ 10, belongings ≥ 6, broken windows ≥ 4, blood trails ≥ 4, emergency vehicles ≥ 2), exactly 1 smoking vehicle, and zero burned-facade, collapsed or rubble assets | static |
| E20-AC16 | **Midday light:** `timeOfDay.L2.polar` ≤ 0.40 rad and ≤ `timeOfDay.L1.polar` − 0.30; a 1.8 m probe's shadow at `l2-streets-w1` is ≤ 0.6× its length at the matching L1 spot (shadow-mask measurement) | unit + visual |
| E20-AC17 | **Checkpoints:** dying right after each of `doors`, `escape`, `cluster` restores the snapshot (entities, outbreak layer, firefighter states, gate states, carried weapons) within tolerance | sim |
| E20-AC18 | **Real-input playthrough:** headless Playwright drives L2 from the station to the closing gate with mouse/keyboard only (axe pickup via `E`, boarding by interaction), 1 seed, 0 console errors, screenshots at all §6 photo spots | real-input e2e |
| E20-AC19 | **Vision review** (checklists A, D, E, G + this list): `l2-station-calm` reads "organized help still exists"; the `l2-doors-open` pair reads "brief success → instant chaos"; `l2-streets-w1` vs the L1 spot reads "wounded, but still standing" (damage visible, not post-apocalyptic); `l2-bridge-checkpoint` reads "organized control"; L2 light reads clearly harder and higher than L1. Each ≥ 7/10, no P0/P1 findings | vision |
| E20-AC20 | **Performance:** high tier holds the E18 budgets at `l2-collapse` (≥ 30 civilians + 6 firefighters + ≥ 30 infected) and the low tier at its scaled counts; no frame > 50 ms on `l2.doorsOpen` (the ambush reveal) or the gate close | perf |

## 9. Notes for implementers
- Reuse the E19 L1 controller pattern (`LevelOneOutbreak.ts`): script only up to `l2.doorsOpen`, then hand over to the outbreak systems. The director emergence rule (E19-AC25) is the ambush mechanism.
- The fire truck is `veh.fire-engine` driven as a kinematic passenger vehicle (the E08 convoy path follower); it needs crew-seat nodes (asset change in `05-asset-inventory.md` §6.3).
- E08's per-level density table (L2 = 40) matches 30 trapped + ~10 street civilians; update the E08-AC11 fixture when L2 is rebuilt.
- After the collapse the truck is boxed in and its doors are inert (orchestrator default — PO may change): it is not an escape vehicle.
