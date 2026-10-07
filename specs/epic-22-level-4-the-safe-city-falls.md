# E22 · Level 4: The Safe City Falls

> **Rewritten 2026-10-07 per product owner** (`po-levels-2-6-2026-10-07.md`, which wins on any disagreement). This replaces the previous L4 "Open the Escape Route" (fire-station hub, substation breakers, zoo route, bridge blockade, Butcher). That content is superseded; the D-ZOO / D-EDGE assets and the zoo elites stay in the repo for later use. The old L4 mission case in `src/levels/missions.ts` and the one `@E22-AC04` test (breaker interruption) describe the old design: re-tag or retire them. Systems are reused (devices, defend steps, explosions, fire).

## 1. Goal

A ~5-minute level that begins as a **deliberate false reset**. The player arrives in an army evacuation convoy at **Fairhaven** (orchestrator default name for the second city — PO may change), a city the outbreak has not reached: clean streets, intact buildings, pedestrians, open shops, an organized army. The army issues the player a **machine gun**, the strongest weapon so far, with unlimited ammunition. Then, while evacuees unload and gather, **one or more evacuees turn**, and the evacuation has brought the outbreak into the safe city. It becomes the first **large-scale war scene**: ~20 soldiers, ~50 civilians (many armed with pistols, hunting rifles and improvised weapons), heavy machine guns, military vehicles, a tank and a helicopter, against rapidly increasing infected. The player feels powerful, and it is still not enough. The city collapses; the player reaches a **basement**, goes inside alone, shuts the door, and the war continues above.

Emotional outcome: **"Everyone is fighting, and it is still not enough."** Escalation position: **the army enters the fight, and a supposedly safe second city falls into full-scale warfare.** Relationship: the player fights alongside an army.

## 2. Depends on / Enables

E21 (allied fighters v2, the army checkpoint and buses, handgun), E06 (machine gun, §5.3), E07, E08 (crowd civilians, convoy path follower), E09 (buses, military vehicles as kinematic set pieces), E10 (new district `D-FAIR` with a W0 layer), E12, E14, E15, E16 (war mix), **E18** (budgets and tier scaling for the big scene), E25 (`L4` preset, muzzle/explosion flashes in the light field), E26 (sandbag lines, props launched by blasts), **E27** (tank shells, vehicle and fuel-truck explosions, fires, smoke columns) / **E23** (same district, devastated), M3.

## 3. Scope

**In:** the convoy ride into Fairhaven; district `D-FAIR` (W0, clean and alive; its devastated twin is built in E23); the safe-city beat; the machine gun; the first-turn set piece among the crowd; **allied fighters v3** (soldiers with rifles, heavy-machine-gun crews, armed civilians, §5.4); the military spectacle (HMG nests, trucks, an armored vehicle, a tank, a helicopter); the plaza line and its break; live damage progression; the basement ending; the `L4` preset; performance and quality-tier scaling for the war scene; photo spots, bots, tests.

**Out:** player-driven vehicles; player-controlled tank/HMG (the player only uses the machine gun — orchestrator default; PO may change); special infected archetypes (orchestrator default: turned humans incl. turned soldiers); an ammunition system.

## 4. Level structure and story beats (~5 min)

| # | Beat | Location (`D-FAIR`) | What happens | Target time |
| --- | --- | --- | --- | --- |
| 1 | Convoy | Fairhaven approach road → army gate → Lakeshore Avenue | The player sits in an evacuation bus (passenger) in a convoy of 2 buses, 2 military trucks and a light armored vehicle. The camera follows the bus; through the windows: clean streets, people on sidewalks, open cafés, traffic stopped by soldiers. | 0:00–0:30 |
| 2 | "We made it" | **Reception Plaza** (army evacuation reception: registration tables, tents, triage, water pallets; town hall, shops, apartment blocks around it) | Unloading. Evacuees and Fairhaven residents mingle; soldiers on posts and in sandbag nests; children are kept out of the scene (R1: none in the plaza). Objective: **Report to the quartermaster** → the **machine gun** is issued (stand-to-interact 0.6 s / `E`, auto-equipped). Free walk; nothing happens. | 0:30–1:30 |
| 3 | The turn | registration area in the plaza crowd | Two evacuees from the L3 buses (bandaged forearms) collapse and turn inside the crowd (E19 §5.7 continuity), bite the people around them, and the infection spreads through the gathering. Screams; soldiers shout; the first shots. | 1:30–1:50 |
| 4 | War | plaza and the streets around it | Objective: **Hold the plaza with the army**. Soldiers form lines; HMG nests open fire; armed civilians fight; unarmed civilians panic; newly bitten people turn mid-battle. From +30 s infected also charge in from the streets on ≥ 3 sides (the outbreak followed the convoy). The tank rolls in and fires; the helicopter orbits with door-gun tracers. The machine gun shreds groups. | 1:50–3:20 |
| 5 | The line breaks | plaza | `l4.lineBreaks` (§5.6): the tank shell hits a fuel truck at the plaza edge (E27 mega chain), the line folds, the helicopter pulls out (*"Air support is withdrawing!"*). Radio: *"Line's gone! Everyone find cover!"* Objective: **Find somewhere to hide** (soft marker after 15 s). | 3:20–3:35 |
| 6 | Collapse | Harbor Street, Kessler Lane | Running through total chaos: burning vehicles, fleeing crowds, soldiers fighting in pockets, turned soldiers among the infected. | 3:35–4:30 |
| 7 | The basement | **Kessler's Hardware** cellar door (Kessler Lane) | Stand-to-interact at the cellar door; the player goes down **alone** (corgi included, orchestrator default) and bars the door (1.0 s interact). Inside: one bulb, shelves, dust falling with each explosion; muffled gunfire and explosions continue above for ≥ 6 s. The level ends there; L5 loads. | 4:30–5:00 |

**Checkpoints:** `arrival` (after the machine gun), `turn` (at the first turn), `line-break`. **No fail timer.**

## 5. Systems

E20 §5.1 outbreak rules apply (sight-only, no omniscience, everyone incl. soldiers turns, identity continuity, emergent snowball). Gunfire loud events per E21 §5.3, with radii machine gun 30 m, HMG and tank 40 m.

### 5.1 District `D-FAIR` (Fairhaven downtown)
- ≈ 170 × 130 m, visibly a different, slightly bigger city than Sunset Grove: 3–5 storey brick and stucco apartment blocks with shops at street level, a town hall on the plaza, a church, Lakeshore Avenue (convoy route), Harbor Street (shops), Kessler Lane (back street with the basement), the **Fairhaven Metro** station entrance (closed in L4; the L5 destination).
- Built for **reuse in L5**: every hero building and street gets a devastated variant at the same transform (E23 §5.1); L4 uses the W0 layer only.
- Route rules as E19 (≥ 2 routes from the plaza to the basement, sight blockers every ≤ 25 m).

### 5.2 False safety (until the first turn)
W0 layer: no corpses, wrecks, damage decals or broken windows; ≥ 40 civilians running routines (E19 §5.1 routines: chatting, queuing at registration, carrying bags, sitting on benches), ≥ 6 open shopfronts with lit interiors, ≥ 16 soldiers on posts in orderly positions, the army loudspeaker (*"Welcome to Fairhaven. Please proceed to registration."*). Calm music bed and city ambience.

### 5.3 Machine gun (E06 rule, introduced here)
- 14 damage per round, 10 rounds/s, 4° spread, range 26 m, **pierce 1** (a round can pass through one infected and hit the next), knockback small, aim indicator line.
- **No ammunition system:** unlimited, no reload, no overheat (orchestrator default — PO may change), no ammo HUD.
- The main weapon for L4–L6. Bat, axe and handgun remain carried and selectable.

### 5.4 Allied fighters v3: soldiers and armed civilians
- **Soldiers (~20; 10 on low):** HP 120, rifles (18 damage, 4 rounds/s bursts, 65 % hit chance ≤ 20 m), hold sandbag lines and fall back in pairs; 2 of them crew the HMG nests (HMG: 30 damage, 8 rounds/s, 40 m, operated only by soldiers). They are bitten and turn like anyone (fatigues and helmet kept, rifle dropped).
- **Civilians (~50; 25 on low), ≥ 40 % armed** (orchestrator default for "many"): pistols (handgun stats with 50 % hit chance), hunting rifles (60 damage, 0.6 shots/s), improvised melee (bats, pipes, crowbars, using the existing weapon models on the civilian `weaponSocketR`). Armed civilians fight rather than flee, but flee when ≥ 3 infected are within 4 m; unarmed civilians use E08 panic/flee.
- Allies never damage humans; player weapons never damage allies (E08 rule).

### 5.5 Military spectacle (sim-light, view-heavy)
- 2 HMG nests (one sandbag nest, one on the armored vehicle), 2 military trucks (static after arrival, cover), 1 light armored vehicle, **1 tank** (enters the plaza at ≈ turn + 45 s on a kinematic path, fires its main gun every 8–12 s at the densest infected cluster ≥ 15 m from any player/ally: E27 large blast), **1 helicopter** (orbit at altitude, door-gun tracers onto infected clusters; it withdraws at the line break and never lands). Tank and helicopter are deterministic scripted actors whose targets are chosen by the sim (orchestrator default).
- Every spectacle event is logged (`l4.tankFire`, `l4.heliPass`, `hmg.burst`) and every blast goes through E27 `ExplosionDef`s (damage, impulse, props, scorch).

### 5.6 Turn, spread, line break
- `l4.firstTurn` fires 40–50 s (seeded) after the machine gun is issued, at the latest arrival + 100 s; 1–3 (default 2) evacuees tagged `origin:'L3-bus'` turn where ≥ 10 humans stand within 10 m.
- From turn + 30 s the director lets infected emerge from ≥ 3 street edges ≥ 60° apart (E19 emergence rule), escalating with time.
- **Caps:** concurrent infected ≤ 120 (high) / 60 (low); all simulated characters (infected + soldiers + civilians) ≤ 190 (high) / 95 (low). At the cap bites kill.
- `l4.lineBreaks` fires at the first of: 75 s of plaza defense, living soldiers ≤ 50 %, or ≥ 15 infected inside the sandbag line; it triggers the fuel-truck mega chain (`veh.fuel-truck`, E27 mega) and the helicopter withdrawal.

### 5.7 Live damage progression (W0 → W3, systemic)
No pre-authored damage in L4: everything comes from E27 blasts, fires and E15 decals during the battle (tank shells, the fuel truck, burning vehicles, shattered windows from shockwaves, blood, corpses that persist, E07-AC14). L5 then uses the authored devastated twin, not the live end state (orchestrator default).

### 5.8 Lighting, sound
- Preset `L4` (clean late afternoon): clear air, saturated warm-neutral sun, sun polar 1.15–1.30 rad (between L3 and the L5 sunset; the PO's "several hours" between L4 and L5 is compressed to keep one day — orchestrator default), less haze than L3 (fog far ≥ L3 fog far + 20 m). During the war, muzzle flashes, tracers and explosions feed the light field; smoke columns build up.
- Sound: city ambience and a calm bed until the turn; then the loudest mix of the campaign (layered gunfire, HMG, tank, helicopter rotor, screams); the basement applies a strong low-pass and room reverb.

### 5.9 Basement ending
Only the player (and the corgi) can enter; NPCs and infected never path into the cellar (nav-blocked once the door closes). After `l4.doorBarred`, battle events keep firing outside for ≥ 6 s (heard muffled), then `level.completed` and L5 loads directly (no reward screen).

## 6. Photo spots
`l4-convoy-arrival`, `l4-plaza-safe`, `l4-harbor-street-safe`, `l4-metro-entrance-safe`, `l4-first-turn`, `l4-war-line` (soldiers, armed civilians, HMG, turning people in one frame), `l4-tank`, `l4-collapse`, `l4-basement`. **Pair cameras** for E23 (fixed transforms, captured here in the safe state): `pair-plaza`, `pair-harbor-street`, `pair-metro-entrance`, `pair-kessler-lane`.

## 7. Bruno references
- [`Explosions.js`](../folio-2025/sources/Game/Explosions.js), [`World/Fireballs.js`](../folio-2025/sources/Game/World/Fireballs.js): tank shells, the fuel truck
- [`Trails.js`](../folio-2025/sources/Game/Trails.js): tracers (MG, HMG, door gun)
- [`World/VisualVehicle.js`](../folio-2025/sources/Game/World/VisualVehicle.js): convoy vehicles
- [`Time.js`](../folio-2025/sources/Game/Time.js): bullet time at the mega blast (setting-gated)
- [`InstancedGroup.js`](../folio-2025/sources/Game/InstancedGroup.js): crowd and tracer instancing

## 8. Acceptance criteria

Bots: `complete`, `newbie`, `idle` (stays at the quartermaster), `evade-only`. Time bands are **provisional**; recalibrate on the first green 20-seed run (staging §6, never padded).

| ID | Criterion | Verification |
| --- | --- | --- |
| E22-AC01 | The L4 mission graph (ride → quartermaster → hold the plaza → find cover → bar the basement door) is structurally completable (E12-AC07) and has no fail timer | sim |
| E22-AC02 | The `complete` bot finishes L4 on **20/20 seeds** from `L4-default` (bat, axe, handgun) without cheats; median sim time **2:30–4:00** | sim |
| E22-AC03 | The `newbie` bot finishes on ≥ 18/20 seeds, median **2:45–4:30**, median deaths ≤ 2 | sim |
| E22-AC04 | **Convoy ride:** the player is seated (`vehicle.entered{role:'passenger'}`) in a bus of a 5-vehicle convoy that passes the army gate and reaches the plaza in 20–35 s; player control returns ≤ 0.5 s after the bus stops | sim |
| E22-AC05 | **False safety:** from level start until `l4.firstTurn`: zero infected entities, zero `combat.*` events, zero damage decals/corpses/wrecks/broken windows in `D-FAIR`; ≥ 40 civilians in non-idle routines (none idle facing nowhere > 3 s), ≥ 6 lit open shopfronts, ≥ 16 soldiers on posts | sim + static |
| E22-AC06 | **Machine gun:** acquired only from the quartermaster and auto-equipped; 2,000 continuous rounds never produce a reload, empty, overheat or ammo HUD element; pierce 1 (≥ 1 round hits two infected in line in the table test); clearing a group of 5 infected at 10 m takes ≤ 3 s with the machine gun and ≥ 6 s with the handgun; the `complete` bot's kill rate while firing during the plaza defense is ≥ 1.0 kills/s (median) | sim |
| E22-AC07 | **The turn:** `l4.firstTurn` fires 40–50 s after the machine gun is issued (or at arrival + 100 s); 1–3 evacuees tagged `origin:'L3-bus'` turn with ≥ 10 humans within 10 m (identity continuity); ≥ 5 further humans turn within 30 s (median of 20 seeds) | sim |
| E22-AC08 | **Scale:** 18–22 soldiers and 45–55 civilians at the turn (high tier), ≥ 40 % of civilians armed with each of pistol, hunting rifle and improvised melee present ≥ 3 times; the low tier spawns 50 % of each count; infected ≤ 120 / 60 and total characters ≤ 190 / 95 are never exceeded | sim |
| E22-AC09 | **Everyone fights and everyone can turn:** armed civilians make ≥ 15 % of non-player kills; unarmed civilians flee; soldiers and armed civilians are bitten and turn (same entity id, uniform/clothes kept, weapon dropped) on ≥ 18/20 seeds; no soldier or civilian has a damage-immunity or scripted-survival flag at any tick | sim |
| E22-AC10 | **From all sides, without omniscience:** from turn + 30 s, director infected emerge from ≥ 3 street edges ≥ 60° apart, each first visible within 3 m of an emergence point outside the frustum; the E20-AC11 omniscience audit passes (20 seeds) | sim |
| E22-AC11 | **Military spectacle:** per run, ≥ 2 HMG positions fire (`hmg.burst`), 2 military trucks and 1 armored vehicle are present, the tank enters and fires every 8–12 s through E27 large `ExplosionDef`s (never within 15 m of the player or an ally), the helicopter orbits with door-gun bursts and withdraws at `l4.lineBreaks` without landing | sim |
| E22-AC12 | **Still not enough:** by `l4.lineBreaks` the combined kills (player + allies) are ≥ 60 while the live infected count is ≥ 1.5× its value at turn + 30 s (median); living soldiers are ≤ 60 % at the line break and ≤ 40 % at basement entry (median); every soldier loss is a bite/kill event (no scripted removal) | sim |
| E22-AC13 | **Line break:** `l4.lineBreaks` fires by its first-of rule (75 s / ≤ 50 % soldiers / ≥ 15 inside) and also with the `idle` bot; it plays the fuel-truck mega chain (E27-AC06 detectors) and the objective changes to "Find somewhere to hide" | sim |
| E22-AC14 | **Live damage:** at basement entry the district shows ≥ 4 fires, ≥ 2 burning vehicles, ≥ 10 shattered windows and ≥ 6 scorch decals, each traceable to an explosion/fire event of this run; corpses persist (E07-AC14) | sim |
| E22-AC15 | **Basement ending:** the cellar door accepts only the player (and corgi); no NPC or infected is inside after `l4.doorBarred`; battle events (gunfire/explosions) continue for ≥ 6 s afterwards with the low-pass applied; then `level.completed` and L5 loads with no reward screen | sim + e2e |
| E22-AC16 | **Light:** `timeOfDay.L4.polar` in 1.15–1.30 rad and fog far ≥ L3 fog far + 20 m; 0 smoke columns before `l4.firstTurn` and ≥ 3 at `l4.lineBreaks` (`l4-collapse` frame) | unit + visual |
| E22-AC17 | **Checkpoints:** dying right after `arrival`, `turn`, `line-break` restores the snapshot (allies, armed state, outbreak layer, spectacle actors' state) within tolerance | sim |
| E22-AC18 | **Real-input playthrough:** headless Playwright, mouse/keyboard only, from the bus to the barred basement door, 1 seed, 0 console errors, screenshots at all §6 photo spots and the four pair cameras | real-input e2e |
| E22-AC19 | **Vision review** (checklists A, D, G, H): `l4-plaza-safe` reads "we actually escaped" (clean, intact, alive; contrast against `l3-grove-boulevard`); `l4-war-line` reads "huge mixed war scene"; `l4-tank` and `l4-collapse` read "war zone — everyone is fighting and it is still not enough"; the player stays readable inside the battle (checklist D). Each ≥ 7/10, no P0/P1 | vision |
| E22-AC20 | **Performance and tier scaling:** `perf-l4-war` (the peak: ≥ 15 soldiers firing, ≥ 40 civilians, ≥ 80 infected, tank shot + helicopter + HMG tracers) holds the E18 high budgets (draw calls ≤ 600, triangles ≤ 1.5 M, sim p95 ≤ 4 ms, smoke ≤ 6k / debris ≤ 120, hero lights ≤ 8 (3 shadowed), awake props ≤ 150); the low tier at its scaled counts holds the low budgets; no frame > 50 ms at `l4.firstTurn`, any tank shot, the fuel-truck chain or `l4.lineBreaks` (perf trace) | perf |

## 9. Notes for implementers
- Biggest risk: simulated ally gunfire at this scale. Allies pick targets from the spatial hash at ≤ 4 Hz and resolve shots as hitscan rolls (no projectile bodies); tracers are pooled view-only ribbons.
- Turned soldiers drop their rifles as props (no infected uses weapons).
- E08's density table (L4 = 12) is superseded for L4 by §5.4; update the E08-AC11 fixture when L4 is built.
