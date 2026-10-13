# 05 · Asset Inventory

Historical snapshot date: **2026-10-05**. **Campaign deltas are §7 (2026-10-11) and §8 (2026-10-13 L9/L10)**; §8 wins for L9/L10 and distinguishes verified reuse from planned assets. They supersede older per-level need/status notes below. Historical counts are not current manifest totals. The status lifecycle is defined in `03-asset-pipeline.md` §9. Production pipeline: Codex imagegen → upscaled reference → `bpy` build script → GLB (no img2threejs).

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
5. **Redesign order (2026-10-07, §6):** P1: `int.fire-station-bay`, fire-engine crew seats, supermarket door states, bridge-checkpoint gate/barriers, `bld.police-station`, `D-CORRIDOR` W2/W3 variants, `kit.army-checkpoint`, `veh.evac-bus`; then P2: `D-FAIR` W0 set → its W5 twin, military vehicles (APC, tank, helicopter variant, HMG nest), basement, the subway kit.

`T-E17-06` keeps this file and `src/assets/manifest.json` in sync once the manifest exists.

## 6. Levels 2–6 redesign: asset needs (2026-10-07)

The PO redesigned L2–L6 ([`po-levels-2-6-2026-10-07.md`](po-levels-2-6-2026-10-07.md); epics E20–E24). This table supersedes the per-level "Needed by" notes in §3–§4 for L2–L6. **Manifest** = status in `src/assets/manifest.json` as of 2026-10-07 (331 entries; no entry has `decayVariants` yet). **Missing** = no manifest entry. Prio: **P1** L2–L3 (M2), **P2** L4–L6 (M3).

### 6.1 Characters and allies

| Asset ID | Need (levels) | Manifest | Action | Prio |
| --- | --- | --- | --- | --- |
| `npc.firefighter-alive` | 6 firefighters (L2) | integrated | add held tools via `weaponSocketR` (`wpn.fire-axe`, `wpn.halligan`) | P1 |
| `wpn.halligan` (firefighter pry bar) | firefighter melee, door forcing (L2) | **missing** | new side-tier prop | P1 |
| `npc.police-officer` | station officers + squad (L3), bridge officers (L2) | integrated | handgun on `weaponSocketR` (`wpn.pistol`, integrated) | P1 |
| `npc.national-guard` | ~20 soldiers (L4), army checkpoint (L3) | integrated | rifle on socket (`wpn.assault-rifle`, integrated); helmet/vest variant optional | P2 |
| armed civilians (pistol, hunting rifle, improvised) | L4 (≥ 40 % of ~50) | **composition of existing assets**: `npc.civilian-*` (integrated, have `weaponSocketR`) + `wpn.pistol`, `wpn.hunting-rifle`, `wpn.baseball-bat`, `wpn.crowbar`, `wpn.shovel` (integrated) | no new model; NPC aim/fire animation in code | P2 |
| turned firefighters / police / soldiers / survivors | L2–L6 | **no new asset**: identity continuity uses the living model + the infected overlay (E19 §5.7); `inf.firefighter`, `inf.riot-cop` (integrated) are optional extras | — | — |
| 5 L5 survivors (Dale, Rosa, Mr. Okafor, Mia, Sam) | L5–L6 | integrated bases: `npc.survivor-group`, `npc.paramedic`, `npc.civilian-elderly`, `npc.civilian-woman-a` | **missing**: soot-and-bandage tint/decal variant (`*.aftermath`) | P2 |
| shelter survivors (20–30) + Marcus | L6 | integrated civilian bases | **missing**: aftermath tint variants, injured pose set (sitting, lying, bandaged) | P2 |
| uniformed corpses (firefighter, police, soldier) | L3–L5 dressing | `inf.corpse-poses` (integrated, civilian) | posed living models in code; no new asset | P2 |

### 6.2 Weapons and pickups

| Asset ID | Need | Manifest | Prio |
| --- | --- | --- | --- |
| `wpn.fire-axe` + `icon.fire-axe` | L2 player weapon (roundhouse animation in code) | integrated | P1 |
| `prop.axe-rack` (station wall rack) | L2 optional pickup point | **missing** | P1 |
| `wpn.pistol` + `icon.pistol` | L3 handgun | integrated | P1 |
| `prop.armory-table` | L3 handgun pickup | **missing** | P1 |
| `wpn.machine-gun` + `icon.machine-gun` | L4–L6 player weapon | integrated | P2 |
| `prop.hmg-nest` (sandbag ring + mounted HMG) | L4 spectacle | **missing** (`prop.sandbag-pallet` integrated for the ring) | P2 |
| `pick.medkit` | L3 (≥ 7) | integrated | P1 |
| `pick.*-ammo` | none (no ammunition system) | integrated | decorative only |

### 6.3 Vehicles

| Asset ID | Need | Manifest | Action | Prio |
| --- | --- | --- | --- | --- |
| `veh.fire-engine` | L2 crew transport | integrated (nodes `driverSeat`, `exitL`, `exitR`) | **change**: crew-cab seat nodes `seat_1…seat_7`, rear crew doors, light-bar `ss_light` anchors | P1 |
| `veh.police-sedan`, `veh.police-suv` | L2 checkpoint, L3 station and abandoned cars | integrated | abandoned/doors-open pose variant | P1 |
| `veh.*.wrecked`, `veh.*.burned` (sedans, SUV, pickup, police, ambulance, bus) | L2 crashed cars, L3 wrecks, L5 burned-out cars | **missing** (drafted S17); only the generic `veh.wreck` is integrated | build as `decayVariants` | P1–P2 |
| `veh.evac-bus` (cream coach, blue belt stripe, EVAC destination sign, framed transparent glass over a seated interior, folding door) | L3 checkpoint, L4 convoy (player rides), L7 departure | **integrated, hero rebuild 2026-10-13** (`tools/blender/sslib/evac_bus.py`; 11,292 / 4,470 / 1,904 triangles for LOD0/1/2; `wrecked`/`burned` variants derived from the LOD meshes) | done |
| `veh.military-truck` | L3 checkpoint, L4 convoy and plaza | integrated | P1 |
| `veh.military-apc` (light armored vehicle, mounted HMG) | L3 checkpoint, L4 convoy/spectacle, L5 wreck | **missing** | P2 |
| `veh.tank` (+ `.wrecked`) | L4 spectacle, L5 wreck | **missing** | P2 |
| `veh.helicopter-military` (door gun) | L4 orbit | **missing**; `veh.helicopter` (rescue, integrated) is the base for a livery/door-gun variant | P2 |
| `veh.fuel-truck` | L4 line-break mega blast | integrated | P2 |

### 6.4 Buildings, interiors and kits

| Asset ID | Need | Manifest | Action | Prio |
| --- | --- | --- | --- | --- |
| `bld.fire-station` | L1 end / L2 start (exterior) | integrated | — | — |
| `int.fire-station-bay` (truck bay, lockers, radio desk, kitchen corner, benches, red alarm beacons with `rotate` light anchors) | L2 calm beat | **missing** | new hero interior | P1 |
| `bld.supermarket` + `int.supermarket` (Grove Market) | L2 rescue building | integrated | **change**: chained front doors and loading door with closed/forced/open states, glass with people visible behind | P1 |
| `bld.river-bridge`, `kit.river-terrain` | L2 end / L3 start | integrated | — | P1 |
| `kit.police-bridge-checkpoint` (motorized gate, jersey barriers, crowd fences, light bars) | L2 end / L3 start | `kit.police-checkpoint` integrated; **missing**: `prop.checkpoint-gate`, `prop.jersey-barrier`, `prop.crowd-fence` (drafted S06/S10) | P1 |
| `bld.police-station` (yard, sandbag positions, armory) | L3 | `bld.police` is a **placeholder** | build the hero asset | P1 |
| `D-CORRIDOR` street sets: residential (Oak Ave), shopping (Commerce St), main road (Grove Blvd) | L3 | houses `bld.house-a…e`, `bld.mainstreet-brick`, `bld.joes-diner`, `bld.maple-hardware`, `bld.bus-stop` integrated | **missing**: W2/W3 variants (`decayVariants`) of the street-facing buildings; `decay.looted-store` (empty shelves, merchandise scatter), `decay.damaged-sign`, `decay.makeshift-barricade` (cars/furniture; `decay.furniture-barricade` integrated); `decay.broken-glass`, `decay.boarded-windows`, `decay.dropped-belongings`, `decay.burned-facade` are only **reference** | P1 |
| `kit.army-checkpoint` (T-walls/bastion walls, razor wire, sandbag nests, watchtower, loudspeaker pole, floodlights) | L3 end, L4 convoy gate | **missing** (reuse `prop.sandbag-pallet`, `prop.light-tower-trailer`, `kit.highway-onramp`, all integrated) | P1 |
| `D-FAIR` W0 set (Fairhaven): `bld.apartment-block-a/b` (3–5 storeys with shops), `bld.town-hall`, `bld.church`, `bld.storefront-row`, `bld.metro-entrance`, `bld.kessler-hardware` (variant of `bld.maple-hardware`), `kit.reception-plaza` (registration tables, triage, tents) | L4, L5 | **missing** (`kit.evac-camp` integrated, `prop.tent` placeholder) | P2 |
| `D-FAIR` W5 twin: a devastated variant **at the same footprint** for every hero and street-facing building (burned, shot up, ≥ 4 collapsed/damaged facades), plus `decal.bullet-holes`, `decay.blown-sandbags`, `decay.fuel-truck-crater` | L5 | **missing** (`decay.collapsed-facade`, `decay.rubble-pile`, `decay.crater` are **reference** only) | P2 |
| `int.basement-cellar` (stairs, shelves, one bulb anchor, barrable door) | L4 end / L5 start | **missing** | P2 |
| `int.metro-station` (Lakeshore: concourse, turnstiles, kiosk, benches, platform, signage "Fairhaven Metro") + `int.metro-exit` (Northgate: platform, dead escalator, exit gate) | L5 end, L6 | **missing** | P2 |
| `kit.metro-tunnel` (track segments, cross-passage, side maintenance passage), `kit.maintenance-corridor` (service corridors, pump room, signal room) | L6 | **missing** (`bld.tunnel-portal` integrated is a rail portal, not usable inside) | P2 |
| `prop.service-gate` (closable, braceable), `prop.fluorescent-strip`, `prop.emergency-light` (power groups), `kit.shelter-camp` (mats, blankets, camp lights, water pallet; `prop.crates` integrated) | L6 | **missing** | P2 |

### 6.5 Lighting key frames (E25 vision targets)

**Missing:** `kf-l2-midday`, `kf-l3-late-afternoon-smoke`, `kf-l4-safe-city`, `kf-l5-sunset-ruins`, `kf-l6-subway-emergency`, `kf-l6-night-exit`. **Superseded:** `kf-l4-goldenhour-godrays`, `kf-l5-sodium-dusk`, `kf-l6-fire-night`, `kf-helipad-dawn` (still usable as general mood references).

### 6.6 No longer needed by the campaign (kept in the repo)

The zoo kit and animals (`D-ZOO`), the substation and rail crossing, the helipad and flare stands, the school/gym and baseball-field sets for L2, the brother and Mrs. Alvarez escorts, the special-infected archetype models (§3.2) are not used by the redesigned L2–L6. They stay available for reuse. **Superseded 2026-10-11:** D-ZOO and animals are required by E30/L8 (§7); the helipad/helicopter ending remains retired.

## 7. PO L4–L9 update: verified reuse and new asset needs (2026-10-11)

Source: [`po-levels-4-9-2026-10-11.md`](po-levels-4-9-2026-10-11.md), including later health-bar/special-move updates. This section supersedes older campaign assignments (rocket in L4, zoo in L4, helicopter finale). Check `src/assets/manifest.json`, actual `assets/<id>/build.py`/GLBs and source systems; integrated status does not imply a new variant or drivable behavior is built.

> PO, verbatim: "Alpha should have a health bar and special moves"; "Same for Zoo animals".

### 7.1 Reuse before new builds

| Existing asset/system | Verified state / campaign use | Required change |
| --- | --- | --- |
| `inf.common-worker` | integrated, `assets/inf.common-worker/build.py`, GLB + LOD1/2; existing rigid-part human base | derive **`inf.alpha`**, never a new unrelated human rig |
| `wpn.shotgun`, `icon.shotgun` | integrated; `weapon.shotgun` catalog with 8 pellets, damage/falloff | L5 basement pickup/campaign no-ammo config; no new weapon model |
| `wpn.rocket-launcher`, `icon.rocket-launcher` | integrated; existing projectile and `explosion.rocket`/E27 pools | L7 wreck pickup/unlimited config/crowd radius; `proj.rocket` is reference-only, reuse existing procedural projectile before building a model |
| `veh.evac-bus` | integrated GLB/LOD1/2, used in L4 | L7 working boarding/departure, skyline cinematic; no new bus |
| `veh.military-truck`, `veh.military-apc`, `veh.tank` | integrated GLB/LOD1/2 + wrecked variants | L4 spectacle, L5/L7 wrecks; shared unarmed vehicle.military-apc data/anchors and durability are now on main (L9-S1); staged damage/crash visuals still planned in §8 |
| D-FAIR buildings: apartment blocks, storefronts, town hall, church, Kessler hardware, metro entrance | integrated W0 models and W5 `decayVariants`; `src/levels/L4/layout.ts` / `L5/layout.ts` | retain landmark footprints; derive W6 variants/edge route, do not rebuild the city |
| `decay.collapsed-facade`, `decay.rubble-pile`, `decay.crater`, `decay.blown-sandbags`, fuel-truck crater | source GLBs/LOD1/2 exist, decay props shipped | reuse for W6 severe ruin modules and broken defensive lines |
| `int.basement-cellar`, `int.metro-station`, `int.metro-exit`, `kit.metro-tunnel` | integrated models/LOD1/2 | L5 pickup/visible entrance closure and L6/L7 shared Northgate exit |
| `inf.lion`, `inf.gorilla`, `inf.flamingo`, `inf.cat-tabby`/black | integrated models/LOD1/2; lion/gorilla/flamingo/cat brains in `src/data/infected.ts` | healthy lion/gorilla/flamingo variants, shared bars/special extensions; cat/pet is a reuse reference, not a substitute for required zoo species |
| `amb.elephant`, `amb.zebra` | **manifest placeholders, no production `assets/<id>/` model directories** | build normal bases once; derive **`inf.elephant` / `inf.zebra`**, shared rig/LOD/silhouette |
| `bld.zoo-gate`, existing D-ZOO layout | gate integrated; `layouts/D-ZOO/layout.py` / district data exist | extend campaign zoo with walls/enclosures/staff/service network; inspect each kit piece before treating it as integrated |
| `npc.national-guard`, civilian/paramedic/survivor bases, `prop.sandbag-pallet`, light-tower trailer | integrated; weapon sockets/routines, E25 lights/E26 props already exist | zoo staff tint/accessories, normal-animal care poses, Alpha line-break props; no duplicate soldier/civilian base |
| Road tiles, `kit.highway-onramp`, `kit.river-terrain`, existing rock/tree/grass/building kits | existing road/layout stock and scenery LOD | D-CROSSING uses dry/terrain subsets; terrain chunk streamer/collider/nav residency is **new systems work**, not an existing art capability |

### 7.2 New/derived assets and budgets

All numeric production targets below are **orchestrator defaults** and triangle counts are **per asset/chunk**, LOD0 / LOD1 / LOD2; aggregate **E18** budgets still govern (desktop 1.5M/600 draws, phone 500k/300 draws). Budgets include hidden parts/stump caps. Reuse palette/materials; new asset or variant GLBs have the same forward axis/scale and existing pipeline contracts. Placeholders may unblock gameplay, but not final asset acceptance.

| New need / asset ID | Levels | Reuse/derivation | Triangle budgets LOD0 / 1 / 2; other caps | Priority/status |
| --- | --- | --- | --- | --- |
| `inf.alpha` | L4 2–3; L5 1–2; L7 4–6; L8 3–5 (both tiers) | `inf.common-worker` base, 1.35–1.5× height/heavy torso and limbs, shared human clips; extra charge/slam/throw/roar poses | **8,000 / 3,000 / 1,000**, ≤ 4 palette materials, ≤ 800 KB LOD0, pooled/crowd-baked view; no unique texture per Alpha | P2, missing derived asset |
| Healthy zoo variants `amb.lion`, `amb.gorilla`, `amb.flamingo` | L8 calm | existing infected bases with healthy appearance/eyes, same rig/species/silhouette; normal animals have no bar | **12,000 / 4,000 / 1,500** lion/gorilla; **2,000 / 800 / 300** flamingo; ≤ 4 materials, ≤ 1 MB LOD0 | P2, missing variants |
| Normal bases `amb.elephant`, `amb.zebra` | L8 calm | existing placeholder IDs/concept sources; one normal build per species, reusable normal/infected rigs | **12,000 / 4,000 / 1,500** elephant; **6,000 / 2,000 / 700** zebra; ≤ 4 materials, ≤ 1 MB / 600 KB LOD0 | P2, placeholder→build |
| **`inf.elephant`** | L8 outbreak | **derive from `amb.elephant`** with infected eye/blood/pose variant; reuse charge/swipe and stump contracts, no unrelated elephant mesh | **12,000 / 4,000 / 1,500**, ≤ 4 palette materials, ≤ 1 MB LOD0 | P2, missing infected derivative |
| **`inf.zebra`** | L8 outbreak | **derive from `amb.zebra`** with infected appearance; shared rig, rear-kick/herd-stampede poses | **6,000 / 2,000 / 700**, ≤ 4 palette materials, ≤ 600 KB LOD0 | P2, missing infected derivative |
| Shared world-space HP bars and move telegraphs (procedural view) | Alphas L4/L5/L7/L8; all infected zoo species L8 | reuse palette, pooled billboard/instance buffers, HUD health fill math; no bitmap art needed | bar ≤ 12 triangles/entity, shared ≤ 2 draw calls; ring/arc/sweep marker ≤ 256 triangles/active move, pooled; phone ≥ 48×6 CSS px/contrast ≥ 3:1; count in E18 | P2, new shared view |
| `D-FAIR` `w6` variants + edge corridor ruin kit | L7 and L6 exit preview | existing hero W5 shells, collapsed-facade/rubble/vehicle wrecks, same landmark footprint | facade module **20,000 / 8,000 / 3,000**, rubble **4,000 / 1,500 / 500**, ≤ 4 materials, ≤ 1.5 MB/module; lights/smoke per E18 | P2, new W6 layer/variants |
| Visible metro entrance door/shutter state | L5 end / L6 start | existing metro building/service-gate door pattern; moving leaf/hinge/slide nodes and collider | **1,500 / 600 / 200**, ≤ 2 materials, ≤ 150 KB; closed state observable; sound-only event insufficient | P2, inspect existing closure, fill missing geometry/animation |
| Zoo wall/enclosure/path/service kit | L8 | gate and existing zoo layout, fence kits, normal infrastructure; ≥ 3 internal tunnel mouths | wall segment **1,000 / 400 / 150**; enclosure/service module **8,000 / 3,000 / 1,000**; tunnel mouth **3,000 / 1,200 / 400**, ≤ 4 materials, ≤ 800 KB/module; instanced repeats | P2, inspect/reuse existing pieces, missing modules only |
| Staff healthy/infected looks | L8 | civilian bases with uniform tint/accessory and infection overlay; no new full character | accessory **≤ 500 / 200 / 80**, ≤ 1 extra material, ≤ 80 KB; shared body LOD budgets | P2, new composition/tint |
| `veh.military-apc` unarmed transport + staged damage/final wreck | L8–L9 | integrated base/shared unarmed driveable contract on main; 0-HP floor is driveable, only scripted finale becomes wreck | **12,000 / 5,000 / 2,000** per derived state incl overlays, ≤ 4 materials, ≤ 1 MB LOD0; shared damage overlays, no repair art | P2, L9-S1 retained; remaining stages/crash in §8 |
| `wpn.minigun-mounted` (sandbagged pivot mount, shield, spinning barrel cluster, `heatGlow` emissive node, `seatAnchor`/`muzzle` sockets) | L10 finale | like `prop.hmg-nest`; own build in `sslib/minigun_cure.py` | **3,500 / 1,500 / 800** (built 2,524 / 1,228 / 604), ≤ 8 materials, ≤ 300 KB | P2, built (10-13 `asset-minigun-cure`), QA pending |
| `prop.cure-canister` (backpack, `backSocket` on the +X face) and `prop.cure-canister-pedestal` (research-lab pickup) | L10 | palette-only, emissive teal window | **800 / 500 / 300** and **1,000 / 700 / 400** (built 520 / 390 / 236 and 628 / 490 / 328) | P2, built, QA pending |
| `kit.dispersal-pipe-straight/-elbow/-tee` (2 m pipes, axis 2.4 m, port grid ±4 m) | L10 dispersal complex | modular, `portA/B/C` sockets | straight **1,200 / 500 / 250**, elbow **1,600 / 600 / 300**, tee **1,700 / 700 / 300** | P2, built, QA pending |
| `kit.dispersal-fan-housing` (rotor node `fanRotor`), `-turbine-hall`, `-tank-sphere`, `-tank-bullet`, `-filtration-tower` (17.8 m), `-platform` (+ stair), `-console` (`screen` node, `progressScreen` socket) | L10 dispersal complex | monumental but low-rise; palette-only, no textures | fan **5,000 / 2,000 / 900**, hall **4,000 / 1,800 / 1,200**, sphere **2,800 / 1,200 / 700**, bullet **3,000 / 1,500 / 700**, tower **4,000 / 1,600 / 800**, platform **1,800 / 900 / 600**, console **600 / 300 / 200**; ≤ 8 materials, ≤ 300 KB each | P2, built, QA pending |
| D-CROSSING terrain/road/countryside/dry chunk kit + distant next-city silhouette | L9 | existing roads/rocks/grass/tree/countryside buildings, shared palette; only missing terrain/silhouette modules new | terrain 100 m chunk **10,000 / 3,000 / 800**; road chunk **3,000 / 1,000 / 300**; horizon silhouette **≤ 10,000** combined, ≤ 2 materials, ≤ 1 MB/chunk; residency ≤ 25/9 high/low plus coarse horizon | P2, new district/chunk art; streaming is E31 system |
| Lighting/decay review key frames `kf-l7-w6-night`, `kf-l8-zoo-calm-outbreak`, `kf-l9-open-crossing` | L7–L9 | fixed in-game pair captures first, existing night/fire references as look targets | procedural captures, ≤ 1 image per state at review resolution; no runtime download/new texture dependency | P2, pending review artifacts |

### 7.3 Production order and validation

E07 Alpha derived rig/LODs + bar/four-move views → L4 line-break and L5 shotgun/metro closure → L7 W6/corridor using existing rocket/E27/bus → L8 healthy zoo variants + normal elephant/zebra bases and infected derivatives/all ten moves → L9 unarmed APC state/terrain chunks. Existing assets stay in use; no protected reference images are edited. Validate GLB axis/nodes/LODs/budgets and E18 mixed-scene counters; all 14 special moves get their own planned Scene Lab scene per E07/E30. No new animal rig is assumed built from placeholder status.

## 8. PO L9 modification + L10 The Cure (2026-10-13)

Source: [`po-levels-9-10-2026-10-13.md`](po-levels-9-10-2026-10-13.md), [E31](epic-31-level-9-the-crossing.md) and [E32](epic-32-level-10-the-cure.md). Overrides old APC breakdown/on-foot and pending-finale inventory assignments. These are **planned production rows** unless explicitly verified integrated; do not add fake manifest entries or treat references/placeholders as shipped art in this spec lane.

### 8.1 Verified reuse and minimum extensions

Read-only manifest/source inspection on 2026-10-13 confirms `inf.alpha`, `inf.dog-retriever`, `inf.dog-k9`, `prop.hmg-nest`, `kit.army-checkpoint`, `kit.evac-camp`, `veh.military-apc` GLBs/LODs are **integrated**. `vehicle.military-apc` data and contact/attack durability exist on main; D-CROSSING greybox is present. §7's older missing-Alpha/driveable notes are historical. Reuse existing `wpn.fire-axe`, `wpn.pistol`, `wpn.shotgun`, `wpn.machine-gun`, `wpn.rocket-launcher` and icons, existing normal town/warehouse/ruin/road/bridge stock, E25 light anchors, E27 smoke/debris and E16 voice/music pools. `weapon.army-mg` is the campaign machine-gun action; asset IDs and action IDs are distinct.

`inf.mega-alpha` derives from integrated **inf.alpha**, not an unrelated monster rig. `inf.dog` derives from the **generic retriever/K9** body and animal pipeline, not the player's corgi. Existing retriever/K9 identities need not be renamed or removed. Mega/dog behavioral changes live in E32; region streaming lives in retained L9-S3/S4, not in art scripts. Rotary geometry adapts `prop.hmg-nest` mount/aim/spin conventions; only missing barrels/base/rotation parts are new. Cure uses existing backpack attachment/palette and mission-item representation. Kits are compositions of reusable modules; build only missing low structures and landmark parts.

### 8.2 Asset rows and per-LOD budgets

All triangle counts are **maximum per visible asset/module/chunk, LOD0 / LOD1 / LOD2**, including hidden parts, caps, rotor blades, attachments and overlays. Planned exports provide all three LODs; large visual scale does not waive low-tier limits. ≤4 shared palette materials per hero/module (≤2 for small props), no unique textures per repeated enemy/kit. At most one Mega, one mounted rotary gun and one unique canister. Instance repeated fences/pipes/tanks, merge static modules, pool telegraphs/mist; enforce E18 **1.5M/500k triangles and 600/300 draws in aggregate**, even at widest ending camera. Missing assets are P2 finale requirements, not optional P3 extras.

| Asset ID / need | Level / use | Reuse / visible contract | Triangles LOD0 / LOD1 / LOD2; other caps | Priority / current status |
| --- | --- | --- | --- | --- |
| `veh.military-apc` stages 75/50/25/0% + final wreck | L9 driving/finale | Existing unarmed base: dents, cracked glass, smoke/dead lights; 0-HP remains driveable, wreck only after forced crash; shared wheels/driver anchors | **12,000 / 5,000 / 2,000** total per state incl damage overlays; ≤4 materials, ≤1 MB LOD0; smoke in E27 pool | P2, base/contract integrated; new stage/wreck composition planned L9-A1/A2 |
| `kit.crossing-crash` collapsed bridge/road | L9 outskirts / L10 R1 | Existing bridge/road/rubble/APC wreck composition; impact, crawl and protected passenger/corgi anchors | road/bridge module **12,000 / 4,000 / 1,500**; rubble **4,000 / 1,500 / 500**; ≤4 materials, ≤1 MB/module | P2, planned composition; no new collapse simulation |
| `inf.mega-alpha` | L10 persistent boss | Derive inf.alpha at ≈2× scale, same rigid parts/charge/slam/grab clips, heavier silhouette/unique roar; same stump/axis/socket contracts | **16,000 / 6,000 / 2,000**, ≤4 materials, ≤1.2 MB LOD0; one persistent hero, ordinary bar budget | P2, new derivative planned L10-A1 |
| `inf.dog` | L10 early/mid and mixed assault | Existing generic retriever/K9 rig/LODs + infected look; low quadruped body, eyes and pounce/bite poses; corgi never source | **4,000 / 1,500 / 500**, ≤3 materials, ≤400 KB LOD0; pooled/crowd-baked where applicable | P2, new derivative planned L10-A2; bases integrated |
| `prop.rotary-minigun` / `weapon.rotary-minigun` | L10 mounted finale weapon | One shared mounted mesh, adapt HMG base/socket; separate barrel-spin/aim nodes, muzzle/ejection anchors; weapon action is fixed/mounted, no carried gun | **8,000 / 3,000 / 1,000** total gun+mount; ≤4 materials, ≤800 KB LOD0; one shared GLB, no duplicate weapon model | P2, new rotary derivative planned L10-A3 |
| `prop.cure-canister` | L10 lab/backpack/installed | Unique canister with handle/valve, recognizable medical palette, backpack socket and console installation pose; no weapon slot | **1,500 / 600 / 200**, ≤2 materials, ≤150 KB LOD0; one shared mesh across states | P2, new prop planned L10-A3 |
| `kit.cure-residential` | L10 R2 residential fringe | Existing small houses/garages/porches/hedges, police/security post and abandoned cars; low-rise recognizable outskirts | building module **12,000 / 4,000 / 1,500**; hedge/fence **1,000 / 400 / 150**; ≤4 materials, ≤1 MB/module | P2; **missing modules built 2026-10-13 (L10-A4)**: `bld.cure-duplex` 9,732 / 2,252 / 372, `bld.cure-security-post` 3,580 / 1,112 / 256, `prop.cure-garden-wall` 360 / 120 / 84 (integrated, authored closed LODs; existing houses/garage/porch/hedge/fence/vehicles reused) |
| `kit.cure-industrial` | L10 R3 industrial area | Existing warehouses/utility yards/depot barricades, low service buildings, loading bays and stacks; distinguish from campus | building module **16,000 / 6,000 / 2,000**; stack/service prop **3,000 / 1,000 / 300**; ≤4 materials, ≤1.2 MB/module | P2; **missing modules built 2026-10-13 (L10-A4)**: `bld.cure-warehouse` 12,436 / 3,980 / 440, `bld.cure-service-building` 4,188 / 1,642 / 320, `prop.cure-container-stack` 2,484 / 936 / 144, `prop.cure-drum-stack` 1,056 / 640 / 264 (integrated, authored closed LODs; existing depot/barricade/rubble stock reused) |
| `kit.cure-military` | L10 R4 military zone | Existing army checkpoint/T-walls/sandbags/wire/watchposts, motor pool/trucks/wrecks; checkpoint MG pickup | post/module **8,000 / 3,000 / 1,000**; fence/T-wall **1,000 / 400 / 150**; reused vehicles keep their own LOD budgets | P2, planned composition L10-A5; army kit integrated |
| `kit.cure-research` low laboratories | L10 R5 research campus | Low lab facade/entry modules, existing office/medical stock, terminal/cure anchors; no skyscraper facade | lab module **16,000 / 6,000 / 2,000**; terminal **1,500 / 600 / 200**; ≤4 materials, ≤1.2 MB/lab | P2, planned missing low lab modules L10-A5 |
| `kit.cure-research` tents/generators/vehicles/quarantine fences | L10 R5 | Existing evac/medical tent, emergency generator, research-vehicle tint/composition and fencing; branded signs fictional | tent **4,000 / 1,500 / 500**; generator **3,000 / 1,000 / 300**; vehicle **12,000 / 5,000 / 2,000**; fence **1,000 / 400 / 150** | P2, planned composition; reuse base exports, L10-A5 |
| `kit.cure-dispersal` fans | L10 R7 release landmark | Large ventilation fan/housing module; pivoted rotor node, grille and E25 anchors; silhouette reads at ending distance | **12,000 / 4,000 / 1,500** per fan+housing; ≤4 materials, ≤1 MB/module | P2, planned L10-A6 |
| `kit.cure-dispersal` pipes/turbines | L10 R7 delivery/release | Modular pipe elbows/junctions and turbine assemblies, static merged pipes, rotor pivots on turbines | pipe **2,000 / 700 / 200**; turbine **8,000 / 3,000 / 1,000**; ≤4 materials, ≤800 KB/assembly | P2, planned missing industrial parts L10-A6 |
| `kit.cure-dispersal` pressure tanks/filtration towers | L10 R7 large low-rise complex | Existing utility/pressure stock plus missing tall-but-low industrial vessels; repeated tank silhouette, no skyscrapers | tank **6,000 / 2,000 / 700**; tower **12,000 / 4,000 / 1,500**; ≤4 materials, ≤1 MB/module | P2, planned L10-A7 |
| `kit.cure-dispersal` platforms/console | L10 R7 hold/rocket dodge lanes | Existing grated service decks/railings/stairs and generator/valve/terminal control parts; mounted gun ≤20 m from console | platform **6,000 / 2,000 / 700**; console **2,000 / 700 / 200**; ≤4 materials, ≤600 KB/module | P2, planned composition L10-A7 |
| D-CURE terrain/road/ruin chunks + horizon | L10 R1–R7, destroyed R6 | Reuse D-CROSSING roads/dry terrain/rock/tree/ruins, L9 chunk contracts; region palette/dressing data, coarse horizon on pull-out | 100 m terrain chunk **10,000 / 3,000 / 800**; road **3,000 / 1,000 / 300**; rubble **4,000 / 1,500 / 500**; horizon **≤10,000 combined** | P2, planned D1–D4 assembly; L9-S3/S4 streaming prerequisite |
| Mist, Mega ring/telegraphs, heat/charge bars, title/credits | L10 | Procedural E15/E27 mist, existing minimap/UI text/health fills; no new image/texture for status bars/title | mist shares **6k/2k** smoke particle budget; ring/telegraph **≤256 triangles/active effect**, HP bar **≤12/entity**, shared bars **≤2 draws** | P2, planned view/evidence; no raster production lane |
| L10 key frames / pair captures | all regions/finale | Fixed cameras in E32 §6, dog/Mega turntables and fan/canister silhouettes; camera pull-out/mist frame sequence | dev review artifacts only, no runtime texture/download cost | P2, planned Q1/Q2; no protected reference edits |

### 8.3 Production order and validation

Finish L9 floor/stages/crash/reset and L9-S3/S4 streaming → L10-A1 Mega/A2 dog/A3 gun+canister → A4 fringe/industrial/A5 military/research/A6–A7 dispersal kit → D1–D4 regions → encounters/weapons → finale → epilogue. Every epic lane ≤3 h; reuse bases/variants/anchors before any missing-module build. Dog asset inspection must distinguish generic stock from protected companion. GLB axis/scale/nodes/LOD budgets, palette/license checks and high/low turntables remain E17 acceptance; placeholders unblock logic but do not satisfy final vision criteria. Wide camera and dense assault must pass E18 before assets are final. No source/manifest/build-script changes are part of this spec lane.
