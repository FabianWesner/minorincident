# 05 · Asset Inventory

Snapshot date: **2026-10-05**. The status lifecycle is defined in `03-asset-pipeline.md` §9. Production pipeline: Codex imagegen → upscaled reference → `bpy` build script → GLB (no img2threejs).

## 1. Summary

| Status | Count | What it means |
| --- | --- | --- |
| **Scripted / modeled in Blender** (`build.py` + GLB) | **0** | Nothing has been built with the production pipeline yet. |
| **Legacy procedural study** (img2threejs, not production) | **1** | `veh.fire-engine`: `assets/fire-engine/createFireEngineGenerated.ts` + `object-sculpt-spec.json`. These are **inputs** for the Blender rebuild (dimensions, part list, axle spacing); the model is not used in-game. |
| **Upscaled** reference | **1** | The fire engine: `reference.png` (485×226 crop) → `reference-upscaled.png` (1837×856) |
| **Draft only** (on a concept sheet) | **≈ 230 items** on 10 sheets plus 1 gameplay mockup | Every sheet is 1448×1086 (mockup 1672×941). Single items are only about 60–250 px, so **every drafted item needs crop → upscale** before a Blender build script can be written. |
| **Missing** (needed by the concept, not drafted) | **≈ 120 items** | See §4. The biggest gaps are town-edge infrastructure (L4–L6), decay/destruction variants, living civilians, heavy weapons, and the extraction helicopter. |

> **Update (2026-10-05, later): 11 more Codex sheets (packs 11–21) were added to `initial-drafts/`.** They close most of the gaps listed in §4. See §2b for what each covers, and §4 for status markers (**→ D** = now drafted). Three more sheets followed: animals and zoo (S23), explosions/fire/smoke/lighting FX (S24), and weather moods (S25).

**Key takeaways (original snapshot, before packs 11–21)**

1. Infected coverage is **complete**: all 12 mechanical archetypes have turnaround drafts.
2. Survivors and the corgi have good turnarounds, but **gear tiers 1–4 are not drafted**.
3. **There are no living civilians, cops, or medics.** L1–L3 depend heavily on uninfected people.
4. **District `D-EDGE` has zero drafts**: bridge, rail crossing, tunnel, substation, helipad.
5. **Decay tiers W3–W5** (fires, burned or wrecked variants, rubble, collapsed facades) are mostly missing. Only blood decals, scattered props, and the safe-house barricades exist.
6. Buildings are drafted only inside **dioramas**, so isolated, modular building references must be generated (crop + imagegen cleanup).
7. Long-range weapons beyond pistol, shotgun, and nail gun (SMG, rifle, machine gun, rocket launcher) and a **frag grenade** are missing.

Legend: **D** = draft on sheet · **U** = upscaled · **S** = Blender script exists · **M** = modeled (GLB passes validate) · **L** = legacy img2threejs study · **—** = missing. Priority: **P0** vertical slice (L1), **P1** L2–L3, **P2** L4–L6, **P3** polish.

## 2. Source sheets

| # | File | Pack | Content |
| --- | --- | --- | --- |
| S01 | `survivors-corgi-and-equipment.png` | 01/10 | male and female survivor turnarounds + action poses, portraits, corgi (5 poses + portrait), equipment, backpack variants |
| S02 | `zombies-civilian-characters.png` | 02/10 | 11 civilian infected types, crawlers, head close-ups, extra poses incl. corpses, blood decals |
| S03 | `zombies-emergency-workers-and-mutants.png` | 03/10 | riot cop, hazmat, firefighter, bloated, screamer, sprinter, armored football, butcher, nurse, brute (turnarounds + portraits) |
| S04 | `weapons-consumables-and-survival-props.png` | 04/10 | melee, ranged, consumables, utility, throwables, hazards and interactables, scale comparison |
| S05 | `suburban-homes-backyards-and-street-props.png` | 05/10 | cul-de-sac, street corner, backyard, safe-house dioramas, modular props, porch kit, parked vehicles, detail assets |
| S06 | `roadside-diner-gas-station-and-street-props.png` | 06/10 | diner, gas station, hardware store, main street intersection, lamps, awnings and signage, barriers, pickup, street furniture, bus stop, pumps, diner interior, road signs |
| S07 | `school-playground-and-gym.png` | 07/10 | school entrance, bus zone, playground, gym/cafeteria, modular school props |
| S08 | `shops-interiors-and-retail-props.png` | 08/10 | supermarket, mini-mall, food court, pharmacy/clinic interiors + retail props, neon |
| S09 | `parks-baseball-field-and-campsite.png` | 09/10 | park, baseball field, creek, campground, modular props, nature, outbreak traces |
| S10 | `emergency-services-buildings-vehicles-and-props.png` | 10/10 | police checkpoint, fire station, hospital exterior, evac camp, emergency vehicles, barriers, fencing and lighting, camp and medical, supplies, signs |
| SM | `sunset-grove-combat-gameplay-mockup.png` | – | north-star gameplay frame, HUD layout, ability icons |
| SH | `initial-drafts/home-screen.png` | – | home-screen draft with the "MINOR INCIDENT" title logo |

## 2b. New sheets (packs 11–21, Codex, 2026-10-05)

| # | File | Pack | Covers (former gaps from §4) | Issues to fix when cropping / regenerating |
| --- | --- | --- | --- | --- |
| S12 | `living-civilians-and-story-npcs.png` | 11/21 | healthy civilians (man A/B, woman A/B, elderly man), **civilian kid** (protected contexts only, R1), **Patient Zero courier** (healthy/sick/infected), **brother**, **Mrs. Alvarez**, **helicopter pilot**, **medical cooler** | — |
| S13 | `emergency-responders-and-survivor-allies.png` | 12/21 | police officer, paramedic, firefighter, national guard (alive); **survivor allies**: mechanic, hunter, teen ally (the L4–L5 radio survivor group) | the national guard "US" back patch is fine (generic) |
| S14 | `survivor-gear-tiers-and-action-poses.png` | 13/21 | **gear tiers T1–T4** (m/f; T0 = S01) + **action poses**: front kick, grenade throw, rifle aim, heavy weapon, seated driving | — |
| S15 | `heavy-weapons-throwables-and-abilities.png` | 14/21 | combat knife, fire axe, katana, SMG, hunting rifle, assault rifle, LMG, rocket launcher + rocket, frag, flashbang, **abilities**: shield, ground slam, auto turret | the smoke grenade is not drafted (in the FX sheet, pending) |
| S16 | `heavy-and-special-vehicles.png` | 15/21 | courier van ("Medical Courier"), military truck, box truck ("Hometown Movers"), semi-trailer, **rescue helicopter**, train boxcar / tanker / flatcar | rename "**Riverdale** Freight Co." → a Sunset Grove brand; replace the **"UTLX"** tanker marking (a real railcar reporting mark, R2) |
| S17 | `wrecked-and-burned-vehicles.png` | 16/21 | `.wrecked` + `.burned` variants of sedan red/blue/white, SUV, pickup, police sedan, ambulance, school bus | — |
| S18 | `town-edge-bridge-rail-and-power.png` | 17/21 | **D-EDGE**: steel truss bridge, approach ramp, lift gate, charged bridge pillar, riverbank, river rocks, water tile, rail track, crossing gate, crossing signal, rail control box, tunnel portal, substation transformer, breaker panel, substation fence, switch lever | — |
| S19 | `highway-helipad-and-safe-zone.png` | 18/21 | **Civic Center / safe zone** building, highway on-ramp, highway sign, **helipad**, windsock, flare stand | rename "**Riverdale** Civic Center" → "Sunset Grove Civic Center" and the "Riverside" sign → "Sunset Grove / Exit 12" |
| S20 | `decay-and-destruction.png` | 19/21 | W1 belongings (suitcases, bag, phone, stroller, broken glass), W2 barricades (boarded windows, furniture barricade, graffiti), W3–W4 burned facades (house, shop, diner, school), downed power line, fallen tree, W5 collapsed facade, rubble piles S/M/L, crater, body bags, abandoned checkpoint | — |
| S21 | `gore-gibs-and-blood.png` | 20/21 | gib chunk set, generic limb gibs (arm, leg, head), blood pool, blood drag trail, arterial spray decals | — |
| S23 | `animals-pets-and-zoo.png` | 11* | infected dogs, cats, bird flocks, the full zoo kit, zoo elites, panicked animals | pack number clash (cosmetic) |
| S24 | `explosions-fire-smoke-and-lighting-fx.png` | 16* (FX) | explosion anatomy (7 beats), explosion classes (grenade, propane, car, gas-station mega, toxic), fire (small, car, house windows, embers, Molotov), smoke (orange-lit column, smoke grenade, hydrant steam, toxic gas, dust), **night lights** (light-tower trailer with pools and infected shadows, sodium lamp, police light bar, neon reflected on a wet street) | the diner neon reads "Moonbeam Diner"; ours is **Joe's Diner** (rename); pack number clash (cosmetic) |
| S25 | `weather-and-time-of-day-moods.png` | 17* (mood) | the same street in 6 moods: late-morning sun, overcast, golden hour with god rays, dusk thunderstorm, night fire and fog, first snow at night + weather HUD icons | — |
| S22 | `action-and-minimap-icons.png` | 21/21 | ~30 **action icons** (melee, heavy smash, kick, pistol … turret, corgi fetch, corgi bark, flashlight, lockpick, radio, keys, enter vehicle) + **minimap icons** (player, corgi, objective, escort, safe zone, vehicle, infected, elite, loot) | the "dodge roll" and "sprint" icons are not in the design (keep as candidate ability icons) |

**Still missing after packs 11–21** (being generated or open): the smoke grenade as a held item (only its cloud is in S24), the fire extinguisher, the plank stack and sandbag pallet (partly in S20), the dumpster and sofa (sofa in S20), fuel truck, interiors cubemap atlas, the interior gym and mall in more detail, the "Sunset Fuel" rebranded gas station.

## 3. Drafted assets (exist as draft; status D unless noted)

### 3.1 Player characters and companion

| Asset ID | Source | Needed by | Prio | Notes |
| --- | --- | --- | --- | --- |
| `char.survivor-male` | S01 | all | P0 | 4-view turnaround + bat / swing / pistol poses + portrait |
| `char.survivor-female` | S01, SM | all | P0 | same as male; matches the mockup |
| `char.corgi` | S01, SM | all | P0 | sit, side, back, run, sleep + portrait; teal pack |
| `equip.backpack-teal/red/green/blue` | S01 | progression cosmetics | P3 | 4 variants |

### 3.2 Infected (all 12 archetypes covered)

| Asset ID | Source | Archetype | Prio |
| --- | --- | --- | --- |
| `inf.common-worker` | S02 | Runner | P0 |
| `inf.jogger` | S02 | Runner | P0 |
| `inf.baseball-cap` | S02, SM | Runner | P0 |
| `inf.suburban-mom` | S02 | Runner | P0 |
| `inf.delivery-driver` | S02 | Runner (also the Patient Zero base) | P0 |
| `inf.skater` (aged up to a young adult, R1) | S02 | Runner | P1 |
| `inf.college-student` (aged up from the draft's schoolgirl, R1) | S02, SM | Runner | P1 |
| `inf.bbq-dad` | S02 | Runner | P1 |
| `inf.cashier` | S02 | Runner | P1 |
| `inf.bathrobe-neighbor` | S02 | Runner | P1 |
| `inf.construction-worker` | S02, SM | Brute (light) | P1 |
| `inf.crawler` | S02 | Crawler | P0 |
| `inf.corpse-poses` | S02 extra poses | corpse props | P1 |
| `inf.riot-cop` | S03 | Riot | P1 |
| `inf.hazmat` | S03 | Hazmat | P2 |
| `inf.firefighter` | S03 | Firefighter | P2 |
| `inf.bloated` | S03 | Bloated | P1 |
| `inf.screamer` | S03 | Screamer | P1 |
| `inf.sprinter` | S03 | Sprinter | P1 |
| `inf.armored-football` | S03 | Armored | P2 |
| `inf.butcher` | S03 | Butcher elite | P2 |
| `inf.nurse` | S03 | Nurse | P2 |
| `inf.brute` | S03 | Brute | P1 |

### 3.3 Weapons, consumables, throwables

| Asset ID | Source | Prio |
| --- | --- | --- |
| `wpn.baseball-bat` | S04, SM | P0 |
| `wpn.nail-bat` | S01, S04 | P1 |
| `wpn.crowbar` | S01, S04 | P0 |
| `wpn.machete` | S01, S04 | P0 |
| `wpn.shovel` | S04 | P1 |
| `wpn.police-baton` | S04 | P1 |
| `wpn.pistol` | S01, S04 | P1 |
| `wpn.shotgun` | S04 | P1 |
| `wpn.nail-gun` | S04 | P1 |
| `thr.molotov` | S04 | P1 |
| `thr.pipe-bomb` | S04 | P1 |
| `thr.firecracker-lure` | S04 | P1 |
| `pick.medkit`, `pick.soda`, `pick.energy-drink`, `pick.bandages` | S04 | P0–P1 |
| `pick.pistol-ammo`, `pick.shotgun-ammo`, `pick.nail-ammo` | S04 | P3 (decorative; reserve ammo is infinite) |
| `util.flashlight`, `util.radio`, `util.keys`, `util.batteries`, `util.lockpick-kit` | S01, S04 | P1 (objective items) |

### 3.4 Interactables and hazards

| Asset ID | Source | Prio |
| --- | --- | --- |
| `haz.spike-barricade` | S04 | P2 |
| `haz.gas-can` | S04, S05 | P1 |
| `haz.car-alarm` | S04 | P1 |
| `haz.fuse-box` | S04 | P2 |
| `haz.propane-tank` | S04 | P1 |
| `prop.shopping-cart` | S04, S06, S08 | P1 |
| `prop.folding-chair` | S04 | P2 |

### 3.5 Vehicles

| Asset ID | Source | Status | Prio |
| --- | --- | --- | --- |
| `veh.fire-engine` | S10 | **integrated** (Blender pilot, E17-AC04; legacy study retained as reference) | P2 (L6 set piece); built early as the pipeline pilot |
| `veh.sedan-red`, `veh.sedan-blue`, `veh.sedan-white` | S05 | D | P0 (traffic) / P1 (drivable) |
| `veh.school-bus` | S05, S07, SM | D | P1 |
| `veh.suv-dark` (safe-house) | S05 | D | P1 |
| `veh.pickup-red` | S06 | D | P1 |
| `veh.pickup-white` | S06 hardware | D | P2 |
| `veh.sedan-green` / `veh.suv-green` | S05, S06 | D | P2 |
| `veh.police-sedan`, `veh.police-suv` | S10 | D | P1 |
| `veh.ambulance` | S10 | D | P1 |
| `veh.jeep-red` (campground) | S09 | D | P3 |
| `prop.stop-here-sign-trailer` | S10 | D | P2 |

### 3.6 Buildings and set dressing (drafted inside dioramas → need isolated references)

| Asset ID | Source | District | Prio |
| --- | --- | --- | --- |
| `bld.house-a/b/c` (2 variants seen + garage) | S05 dioramas | D-RES | P0 |
| `bld.safe-house` (barricaded house) | S05 | D-RES | P2 |
| `kit.porch-stairs` | S05 | D-RES | P0 |
| `bld.shed` | S05 | D-RES | P1 |
| `bld.joes-diner` (+ sign "Good Food Brighter Days") | S06 | D-MAIN | P0 |
| `bld.gas-station` (canopy + shop + price sign); **rebrand to the fictional "Sunset Fuel"**: the draft shows a real trademark (R2) | S06 | D-MAIN | P1 |
| `bld.maple-hardware` | S06 | D-MAIN | P1 |
| `bld.mainstreet-brick` (bakery / drugs) | S06 | D-MAIN | P0 |
| `bld.bus-stop` | S06, S07 | D-MAIN | P1 |
| `int.diner` (booths, stools, jukebox, checker floor) | S06 | D-MAIN | P3 |
| `bld.school-elementary` (entrance facade) | S07 | D-SCHOOL | P1 |
| `int.gym-cafeteria` | S07 | D-SCHOOL | P2 |
| `kit.playground` (tower, slide, monkey bars, swings, spring duck) | S07, S09 | D-SCHOOL / D-PARK | P1 |
| `int.supermarket` (shelves, freezers, checkouts) | S08 | D-SHOP | P1 |
| `int.mini-mall` (storefronts, planters, escalator) | S08 | D-SHOP | P2 |
| `int.food-court` | S08 | D-SHOP | P2 |
| `int.pharmacy-clinic` | S08 | D-SHOP / L1 finale | P0 |
| `bld.fire-station` | S10 | D-CIVIC | P2 |
| `bld.hospital-exterior` | S10 | D-CIVIC | P2 |
| `kit.police-checkpoint` (tent, barriers, lights) | S10 | D-CIVIC | P1 |
| `kit.evac-camp` (tents, med cots, generator, porta-potty, fence) | S10 | D-CIVIC | P1 |
| `bld.gazebo`, `bld.restroom-block`, `bld.dugout`, `kit.bleachers`, `prop.scoreboard` | S09 | D-PARK | P1 |
| `kit.creek-bridge-wood` | S09 | D-PARK | P2 |
| `kit.campground` (tent, fire pit, cooler, lantern) | S09 | D-PARK | P3 |

### 3.7 Modular street props (drafted; mostly P0–P1)

From S05/S06/S07/S09/S10: picket fence, hedge, flower bushes, planter box, flamingo, mailboxes (blue USPS, red, black), trash and recycle bins, fire hydrant, street lamp (3 styles), utility pole with wires, street-name signs, stop / speed limit / pedestrian / route 66 signs, traffic light, bench (2 styles), picnic table, BBQ grill, shed, folding lawn chair, wagon, red gas can, barricade, traffic cone, barrel cone, jersey barrier, crowd-control fence, sandbags, manhole, storm drain, newspaper box, vending machine, ice chest, oil drum, tire, awnings (4), neon signs (DINER, OPEN, cup, pharmacy cross, BURGER TOWN, SALE), chalkboard sign, bike, bike rack, lockers, school desks, basketball hoop, trophy case, exit sign, first-aid cabinet, chain-link fence, floodlight tower, light trailer, loudspeaker pole, generator, supply crates, water pallet, cardboard boxes, porta-potty, cots, wheelchair, IV stand, privacy screen, evacuation sign, "Stay calm" sign, teddy bear, hazard tape, trees (cherry, oak, pine), bushes, rocks, cattails, stumps, trail signposts, map board, life ring, flag pole.

### 3.8 Decals, FX, and UI (drafted)

| Asset ID | Source | Prio |
| --- | --- | --- |
| `decal.blood-splats` (≈8 shapes), `decal.footprints`, `decal.papers` | S02, S05, S08 | P0 |
| `ui.logo` (D; "MINOR INCIDENT") | SH | P0 |
| `ui.hud-layout` (portrait, bars, minimap, cards) | SM | P0 |
| `ui.icon.bat / vortex / grenade / corgi` | SM | P1 |
| `ui.portrait.survivor-m/f`, `ui.portrait.corgi` | S01 | P0 |
| `ui.palette-swatches` (per sheet) | all | P0 (palette definition) |

## 4. Missing assets (needed by the concept, no draft)

### 4.1 Characters (living people and story NPCs)

| Asset ID | Needed by | Prio |
| --- | --- | --- |
| **→ D (S12)** `npc.civilian-adult-m/f` (×4 variants; can share bodies with infected but healthy skin and no blood) | L1–L3 crowds, panic | **P0** |
| **→ D (S12)** `npc.civilian-kid`, `npc.civilian-elderly` | L1–L2 | P1 |
| **→ D (S12, S16)** `npc.patient-zero-courier` (healthy → sick → infected states) + `prop.medical-cooler` + `veh.courier-van` | L1 story | **P0** |
| **→ D (S12)** `npc.brother` (escort, about 10 years old, backpack) | L2 | P1 |
| **→ D (S12)** `npc.mrs-alvarez` (elderly neighbor escort) | L2 | P1 |
| **→ D (S13)** `npc.police-officer`, `npc.paramedic`, `npc.firefighter-alive`, `npc.national-guard` | L2–L5 (W1–W3 living emergency response) | P1 |
| **→ D (S13: mechanic, hunter, teen ally)** `npc.survivor-group` (3 radio survivors, L4–L5 allies) | L4–L5 | P2 |
| **→ D (S12)** `npc.helicopter-pilot` | L6 ending | P3 |
| **→ D (S14)** `char.survivor-*.gear-t1..t4` (backpack + tape, pads + holster, vest + cap, heavy vest + belts + gas mask) | progression visuals | P1 |
| **→ D (S14)** `char.survivor-*.poses-extra` (kick, throw arc, two-hand rifle, heavy weapon, driving) | animation references | P1 |

### 4.2 Weapons and actions

| Asset ID | Needed by | Prio |
| --- | --- | --- |
| **→ D (S15)** `wpn.knife` | L1 option, short range | P1 |
| **→ D (S15)** `wpn.fire-axe` (also the firefighter infected's prop) | L4 | P2 |
| **→ D (S15)** `wpn.katana` / sword | concept loadout "sword + shotgun" | P2 |
| **→ D (S15)** `wpn.smg` | L3 unlock | P1 |
| **→ D (S15)** `wpn.hunting-rifle` | L3 unlock | P1 |
| **→ D (S15)** `wpn.assault-rifle` | L4 | P2 |
| **→ D (S15)** `wpn.machine-gun` (LMG) | L4–L5 | P2 |
| **→ D (S15)** `wpn.rocket-launcher` + `proj.rocket` | L4–L6 | P2 |
| **→ D (S15)** `thr.frag-grenade` | L2 / concept loadout | P1 |
| **→ D (S15)** `thr.flashbang` | L4 | P2 |
| **→ D (S15)** `abl.shield-bubble`, `abl.ground-slam`, `abl.turret` (deployable) | upgrades | P2 |
| **→ D (S22)** `ui.icon.*` for every action (≈ 30 icons, mockup card style) | HUD, upgrade cards | P1 |

### 4.3 Vehicles

| Asset ID | Needed by | Prio |
| --- | --- | --- |
| **→ D (S17)** `veh.*.wrecked`, `veh.*.burned` (sedan ×3, SUV, pickup, police, ambulance, bus) | W2–W5 decay | P1–P2 |
| **→ D (S16)** `veh.courier-van` | L1 | P0 |
| **→ D (S16)** `veh.military-truck` | L5 convoy, L4–L5 dressing | P2 |
| **→ D (S16)** `veh.box-truck` / `veh.semi-trailer` (heavy blockers) | L4 roadblocks | P2 |
| **→ D (S16)** `veh.helicopter` (rescue) | L6 ending | P2 |
| **→ D (S16)** `veh.train-freight` (static wagons at rail crossing) | L4 | P3 |

### 4.4 District D-EDGE (completely missing)

| Asset ID | Needed by | Prio |
| --- | --- | --- |
| **→ D (S18)** `bld.river-bridge` (steel truss or concrete, modular segments, lift/barrier gate, demolition charges) | L4, L5, L6 | P2 |
| **→ D (S18)** `kit.river-terrain` (riverbank, water surface, rocks) | L4–L6 | P2 |
| **→ D (S18)** `kit.rail-crossing` (tracks, gates, signal lights, control box) | L4 | P2 |
| **→ D (S18)** `bld.tunnel-portal` + interior segment | L4 (option) | P3 |
| **→ D (S18)** `bld.power-substation` (transformers, breaker panels, fence, warning signs, switch levers) | L4 | P2 |
| **→ D (S19)** `kit.highway-onramp` (ramp, guard rails, overhead sign) | L6 | P3 |
| **→ D (S19)** `bld.helipad` (pad, landing lights, windsock, flare stand) | L6 | P2 |
| **→ D (S19, rename)** `bld.civic-center` (safe-zone main building, gym-type hall) | L3 | P1 |

### 4.5 Terrain and road tile kit (seen in dioramas; must be isolated)

`tile.road-straight / corner / t / cross / culdesac / crosswalk`, `tile.sidewalk + curb`, `tile.driveway`, `tile.lawn`, `tile.parking-lot` + markings, `tile.school-yard`, `tile.plaza-pavers`. These are procedural in code; reference images are optional and only needed for texture or color matching. **P0**

### 4.6 Decay and destruction (W1–W5)

| Asset ID | Tier | Prio |
| --- | --- | --- |
| **→ D (S20)** `decay.dropped-belongings` (suitcases, bags, phones, strollers) | W1+ | P1 |
| **→ D (S20)** `decay.broken-glass`, `decay.boarded-windows`, `decay.furniture-barricade` | W2+ | P1 |
| **→ D (S20)** `decay.burned-facade` variants per building type (house, brick, diner, school) | W4–W5 | P2 |
| **→ D (S20)** `decay.collapsed-facade` / `decay.rubble-pile` (3 sizes) | W5 | P2 |
| **→ D (S20)** `decay.downed-power-line`, `decay.fallen-tree`, `decay.crater` | W3–W5 | P2 |
| **→ D (S20)** `decay.body-bag`, `decay.abandoned-checkpoint` (knocked-over tent, scattered barriers) | W3–W4 | P2 |
| **→ D (S20)** `decay.graffiti` decals ("STAY OUT", "ALIVE INSIDE", "SG ✗") | W3+ | P3 |

### 4.7 FX (procedural in code; references only for look)

Muzzle flashes, tracers, explosion (fireball + shockwave + debris), fire (small, medium, building), smoke columns, toxic cloud, electrical sparks / arc, dust, car smoke / fire damage states, siren light glow, ash particles, rain (optional), screamer shockwave ring, hit sparks, lunge telegraph. **P0–P2** depending on the feature.

### 4.8 UI and narrative art

Title screen key art, character select background, level intro cards ×6 (briefing illustrations), upgrade card frames + family art (≈10), mission result screens ("Mission successful · Outbreak not contained", etc.), the ending shot (helicopter over a burning town at dawn, smoke on the horizon), minimap icons, loading tips illustrations. **P1–P3**

### 4.8b Lighting key frames and light-bearing assets

| Asset ID | Needed by | Prio |
| --- | --- | --- |
| `kf-light-trailer-night`, `kf-l4-goldenhour-godrays`, `kf-l5-sodium-dusk`, `kf-l6-fire-night`, `kf-mall-polished-floor`, `kf-helipad-dawn` (Codex imagegen mood targets, `assets/_keyframes/lighting/`) | E25 vision reviews | P1 |
| `prop.light-tower-trailer`: **reference render exists (unlit)**, which is the E25 showcase; needs `light:flood_L/R` anchors, `emi_` lamp faces, and a generator power group | L3–L6, `light-lab` | P1 |
| Interior cubemap atlas (diner, pharmacy, living room, shop, gym) for interior-mapped windows | E25 | P2 |
| Every street lamp, sign, vehicle, and building with lights needs `ss_light` anchors (part of each script, not separate assets) | E25 | — |

### 4.8c Movable and barricade props (E26) and explosion/smoke props (E27)

| Asset ID | Source | Prio |
| --- | --- | --- |
| Drafted movables: cones, bins, carts, benches, picnic tables, crates, drums, propane, chairs, coolers, wagons, bikes, lockers, school desks, sandbags | S04–S10 | P0–P1 (need `ss_physics`) |
| `prop.plank-stack` + plank boards (board-up points) | — (missing) | P1 |
| `prop.sandbag-pallet` (braces into a sandbag wall) | S05/S10 sandbags (drafted as a pile) | P1 |
| `prop.dumpster`, `prop.sofa`, `prop.pallet`, `prop.vending-cart` | — (missing; vending machine drafted) | P1 |
| `prop.fire-extinguisher` | — (missing) | P2 |
| `thr.smoke-grenade` | — (missing) | P1 |
| `prop.tear-gas-canister` | — (missing) | P2 |
| `debris.wood-small`, `debris.metal`, `debris.glass`, `debris.rubble` sets | — (missing) | P1 |
| `veh.*` detachable doors and hoods (separate nodes in vehicle scripts) | vehicles | P1 |
| `veh.fuel-truck` (L6 mega blast) | — (missing) | P2 |

### 4.8d Animals and zoo (decision A1)

**→ D (S23)**: drafted in `animals-pets-and-zoo.png` (dogs ×3 incl. K9 turnarounds, cats ×2 on fences, crow and pigeon flocks, the zoo entrance with ticket kiosk and map, lion / gorilla / flamingo / petting-zoo / reptile-house enclosures, infected lion, gorilla incl. crate throw, flamingos, stampeding zebras and an elephant). Its pack label reads "11" (it clashes with S12; cosmetic).

| Asset ID | Needed by | Prio |
| --- | --- | --- |
| `inf.dog-retriever`, `inf.dog-dachshund`, `inf.dog-k9` (+ healthy pet versions for civilians) | L2+ | P1 |
| `inf.cat-tabby`, `inf.cat-black` | L2+ | P1 |
| `inf.crow` (flock, crowd-baked), `amb.pigeon` (ambient, flees) | L3+ / W0 | P1 |
| `inf.lion`, `inf.gorilla`, `inf.flamingo` | L4 zoo | P2 |
| `amb.zebra`, `amb.elephant` (uninfected stampede hazard) | L4 zoo | P2 |
| Zoo kit: entrance gate + sign "Sunset Grove Zoo", ticket kiosk, enclosures (lion, gorilla, flamingo pond), petting-zoo fence, reptile house, maintenance shed, zoo map board | D-ZOO | P2 |

### 4.9 Gore assets (Q8: more gore)

| Asset ID | Needed by | Prio |
| --- | --- | --- |
| Stump caps on every infected model (`stump_*` nodes) | dismemberment | P0 (part of each infected script) |
| **→ D (S21)** `gib.chunk-set` (6–8 chunky low-poly gib shapes in palette reds, reusable) | explosions, run-overs | P1 |
| **→ D (S21)** `gib.limb-generic` fallbacks (arm, leg, head) for crowd instances | crowd dismemberment | P1 |
| Blood-accumulation masks (vertex-color layer `blood` on survivors, weapons, vehicles) | blood build-up | P1 |
| **→ D (S21)** `decal.blood-pool` (large), `decal.blood-trail`, `decal.arterial-spray` | gore VFX | P0 |

### 4.10 Audio (outside the imagegen pipeline)

No audio exists. The full list and design are in `09-sound-design.md`; music candidates (MIT-compatible) are in `10-music-sources.md`. Bruno's CC0 music (3 tracks) is reusable; his SFX are not (no license). Tracked in E16.

## 5. Production order (recommended)

0. **Pipeline pilot:** rebuild `veh.fire-engine` in Blender from its upscaled reference, then `char.survivor-female` and `inf.common-worker`. These prove the vehicle, character, and dismemberable infected paths.
1. **P0 slice (L1):** survivors m/f, corgi, 5 Runner variants + crawler, bat/crowbar/machete, medkit/soda, sedans ×3, courier van, Patient Zero + cooler, healthy civilians ×4, houses ×3 + porch kit, diner, main-street brick, pharmacy/clinic, street prop kit, blood decals, HUD/logo/portraits.
2. **P1 (L2–L3):** remaining civilian infected, Brute/Screamer/Sprinter/Riot/Bloated, pistol/shotgun/nail gun/SMG/rifle/frag/molotov/pipe bomb/lure, school + playground, supermarket, gas station, hardware, police, ambulance, school bus, SUV, pickup, checkpoint + evac camp, civic center, escorts, living emergency NPCs, gear tiers, action icons, W1–W2 decay.
3. **P2 (L4–L6):** D-EDGE kit, heavy weapons, Firefighter/Hazmat/Armored/Butcher/Nurse, fire station, hospital, wreck/burned variants, W3–W5 decay, helicopter, military truck.
4. **P3:** interiors (diner, gym, mall, food court), campground, cosmetics, extra UI art.

`T-E17-06` keeps this file and `src/assets/manifest.json` in sync once the manifest exists.
