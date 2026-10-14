# E22 · Level 4: The Safe City Falls

> **Latest PO override 2026-10-13:** "L4: All the civilians switch to Zombies when the alarm starts. That's not good. Keep the civilians like usually, just let Zombies flood in". This supersedes all scripted civilian/evacuee conversions below, including collapse pressure and timed refugee turns. Preserve human panic/hide, new infected emergence, real bite conversions, the collapse beats and Alpha counts. AC07 records the corrected rule.

> **Updated 2026-10-11 per product owner** (`po-levels-4-9-2026-10-11.md`, which wins on any disagreement). The 2026-10-07 redesign and built content below remain the baseline where they match. Changed acceptance criteria are marked **CHANGED 2026-10-11**; prior implementation notes describe historical evidence, not acceptance of the new scope. This replaces the previous L4 "Open the Escape Route" (fire-station hub, substation breakers, zoo route, bridge blockade, Butcher). That content is superseded; the D-ZOO / D-EDGE assets and the zoo elites stay in the repo for later use. The retired breaker design belongs to the historical 2026-10-07 redesign; retain the currently built convoy/war tests and extend their existing tags. Systems are reused (devices, defend steps, explosions, fire).

## 1. Goal

A ~5-minute level that begins as a **deliberate false reset**. The player arrives in an army evacuation convoy at **Fairhaven** (orchestrator default name for the second city — PO may change), a city the outbreak has not reached: clean streets, intact buildings, pedestrians, open shops, an organized army. The army issues the player a **machine gun**, the strongest weapon so far, with unlimited ammunition. Then, while evacuees unload and gather, **one or more evacuees turn**, and the evacuation has brought the outbreak into the safe city. It becomes the first **large-scale war scene**: ~20 soldiers, ~50 civilians (many armed with pistols, hunting rifles and improvised weapons), heavy machine guns, military vehicles, a tank and a helicopter, against rapidly increasing infected. The player feels powerful, and it is still not enough. The city collapses; the player reaches a **basement**, goes inside alone, shuts the door, and the war continues above.

> PO, verbatim: "The outbreak starts inside the perimeter, among the evacuees. People turn behind the military lines, civilians panic and block fields of fire, and new infected appear faster than soldiers can contain them."
>
> "Level 4 also introduces the first Alpha infected. They are rare, very large, extremely strong human infected inspired by the Alpha idea from 28 Years Later. They are not fantasy monsters or bosses, but unusually resilient infected that can absorb concentrated gunfire and physically break defensive lines. Their real tactical value is that soldiers have to focus on them while regular infected overwhelm the gaps."
>
> "The battle escalates into full-scale urban warfare with soldiers, armed civilians, military vehicles and huge numbers of infected. Everyone is fighting, but it still is not enough."
>
> "The player eventually escapes alone into the basement of a hardware store and hides there while the city collapses above."

Emotional outcome: **"Everyone is fighting, and it is still not enough."** Escalation position: **the army enters the fight, and a supposedly safe second city falls into full-scale warfare.** Relationship: the player fights alongside an army.

## 2. Depends on / Enables

E21 (allied fighters v2, the army checkpoint and buses, handgun), E06 (machine gun, §5.3), E07, E08 (crowd civilians, convoy path follower), E09 (buses, military vehicles as kinematic set pieces), E10 (new district `D-FAIR` with a W0 layer), E12, E14, E15, E16 (war mix), **E18** (budgets and tier scaling for the big scene), E25 (`L4` preset, muzzle/explosion flashes in the light field), E26 (sandbag lines, props launched by blasts), **E27** (tank shells, vehicle and fuel-truck explosions, fires, smoke columns) / **E23** (same district, devastated), M3.

## 3. Scope

**In:** the convoy ride into Fairhaven; district `D-FAIR` (W0, clean and alive; its devastated twin is built in E23); the safe-city beat; the machine gun; the first-turn set piece among the crowd; 2–3 `inf.alpha` human infected (E07 §Alpha); **allied fighters v3** (soldiers with rifles, heavy-machine-gun crews, armed civilians, §5.4); the military spectacle (HMG nests, trucks, an armored vehicle, a tank, a helicopter); the plaza line and its break; live damage progression; the basement ending; the `L4` preset; performance and quality-tier scaling for the war scene; photo spots, bots, tests.

**Out:** player-driven vehicles; player-controlled tank/HMG (the player only uses the machine gun — orchestrator default; PO may change); zoo animals and boss encounters; an ammunition system.

## 4. Level structure and story beats (~5 min)

| # | Beat | Location (`D-FAIR`) | What happens | Target time |
| --- | --- | --- | --- | --- |
| 1 | Convoy | Fairhaven approach road → army gate → Lakeshore Avenue | The player sits in an evacuation bus (passenger) in a convoy of 2 buses, 2 military trucks and a light armored vehicle. The camera follows the bus; through the windows: clean streets, people on sidewalks, open cafés, traffic stopped by soldiers. | 0:00–0:30 |
| 2 | "We made it" | **Reception Plaza** (army evacuation reception: registration tables, tents, triage, water pallets; town hall, shops, apartment blocks around it) | Unloading. Evacuees and Fairhaven residents mingle; soldiers on posts and in sandbag nests; children are kept out of the scene (R1: none in the plaza). Objective: **Report to the quartermaster** → the **machine gun** is issued (stand-to-interact 0.6 s / `E`, auto-equipped). Free walk; nothing happens. | 0:30–1:30 |
| 3 | The turn | registration area in the plaza crowd | Two evacuees from the L3 buses (bandaged forearms) collapse and turn inside the crowd (E19 §5.7 continuity), bite the people around them, and the infection spreads through the gathering. Screams; soldiers shout; the first shots. | 1:30–1:50 |
| 4 | War (CHANGED 2026-10-12, l4-collapse: three lines fall on beats, see §5.6c) | plaza and the streets around it | Objective: **Hold the plaza with the army**. Soldiers form lines; HMG nests open fire; armed civilians fight; unarmed civilians panic; newly bitten people turn mid-battle. From +30 s infected also charge in from the streets on ≥ 3 sides (the outbreak followed the convoy). The tank rolls in and fires; the helicopter orbits with door-gun tracers. The first 2–3 Alphas enter during this battle; soldiers concentrate fire while regular infected reach the gaps (E07). The machine gun shreds groups. | 1:50–3:20 |
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
- The main group-clearing weapon from L4 onward; the L5 shotgun adds the close-range single-target role. Bat, axe and handgun remain carried and selectable.

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
- ~~`l4.lineBreaks` fires at the first of: 75 s of plaza defense, living soldiers ≤ 50 %, or ≥ 15 infected inside the sandbag line~~ (superseded 2026-10-12 by §5.6c): `l4.lineBreaks` fires 8 s after the third line is lost ("Fall back!"), at the latest 200 s after the turn; it triggers the fuel-truck mega chain (`veh.fuel-truck`, E27 mega) and the helicopter withdrawal.

### 5.6b First Alphas and broken defensive lines
- **CHANGED 2026-10-13 (PO: "add more alphas. The current one has zero chance."):** spawn **6–8 Alphas over the level (8 high, 6 low)**, staggered and from different street mouths and doors, after `l4.firstTurn`; they count inside the existing infected caps. They take a reduced share of the army's damage (soldiers, HMG nests, tank, helicopter, armed civilians; `l4.alphas.allyResist`), the courier's damage is unchanged, and they reach and break the lines and nests (jobs in `l4AlphaEmergence`). No Alpha before L4 in campaign data.
- Use the E07 Alpha resistance table, world-space health bar and four telegraphed special moves: a hit knocks a soldier down; repeated hits destroy E26 barricades/sandbag slots. World-space bars appear when damaged or within 15 m; Charge/Ground slam/Grab and throw/Roar use E07 telegraphs ≥ 0.6 s and cooldowns.
- Orchestrator default: soldiers prioritize a visible Alpha within their existing firing range; in the controlled line fixture ≥ 2 soldiers concentrate on one Alpha for ≥ 3 s while regular infected cross a gap opened by its barricade damage. No omniscient targeting or scripted soldier removal.
- Civilians physically obstruct allied fields of fire: a human in the shot segment suppresses that allied shot; no friendly-fire damage. Reuse ally LOS queries and panic routines.

### 5.6c Collapse director (PO-approved design, 2026-10-12)

> PO 2026-10-12: "zombies, incl alpha have zero chance against the army" and "L4 isn't working at the moment. The idea is that the soldiers cannot hold the lines, but they do easily, so there is no outbreak and no chaos. How should we solve that?" — design approved: "ok let's try that!"

Measured before (seed 2, idle courier): 20 of 20 soldiers alive at the 75 s line break, 0 Alpha knockdowns, 0 barricades broken; the cap of 120 was filled by downed bodies waiting to get up, so new waves stalled and every bite killed instead of turning.

- **The turn behind the lines:** 18 of 24 evacuees (low 9 of 12) turn at once in the registration queue and the waiting rows between the armory table and the tents; soldiers face outward; civilians panic through the firing lanes (shot blocking, §5.6b).
- **Replenishment:** waves × 3 (`l4.war.waveScale`), peak alive capped per tier and per stage (`l4.director.alive`: 80 / 90 / 70 % of the cap, then the full cap); recoverable bodies keep their timers and concurrency slots until they rise; new waves wait when the cap is full. 12 slots stay free so bites turn (snowball). Turned soldiers keep their uniform (and +50 % HP, PO rule).
- **Beats** (`src/sim/missions/L4Collapse.ts`, `l4.director`): line 1 (the nine sandbag-run posts) — a front wave and, while more than half stand, pressure every 4 s from 40 s (people inside turn, infected at the flank out of view), fall back to the reception and the nests at 50–62 s; the nests — two Alphas wait out of sight (NW alley, Lakeshore) and from 104 s charge through the north and south E26 slots and ground-slam the crews behind, fall back to the convoy at 110–124 s; the armour — infected swarm the tank from 150 s, it goes silent, the convoy soldiers retreat in groups of three (the group nearest the courier is cut off by infected from a door ahead) at 170–182 s; then the radio "All units, fall back! Fall back!" and §5.6's line break.
- **Readability:** 1.6 s camera beats (mission cinematics, sim paused, skippable after 0.5 s) at the line-1 overrun and the swarmed tank; radio lines per beat; the elite music stinger per lost line.
- Allied rifle hits no longer stagger an Alpha (damage unchanged): a crowd of soldiers otherwise pinned it in permanent stagger, so it could never use a special move.
- **l4-collapse-2 (2026-10-13):** line 1 pressure from 34 s: bitten refugees (high 5 / low 3 per push) run out of the flank and in through the line to the soldiers (who never shoot people) and turn right behind them; the push's infected come as one burst from the next flank point. The escape street (`l4.director.escape.route`: out of the ring's east side, down the x = −4 street to Lakeshore Avenue, east to Kessler's door): from "Fall back!" (and after a collapse respawn) for 40 s the horde leaves a gap on it — infected beyond 7 m from the courier within 7 m of the route run off toward the army, and nothing emerges on it; pursuers keep chasing. PO 2026-10-14 correction: corpses persist for the whole level, with no time, pile or off-screen removal; frozen instanced corpse pages handle rendering cost; around a courier standing still the chasers take ring slots instead of queueing. Perf: no node build per new corpse page (40 m pages, one frozen material per source material, L4 civilian corpse pages prepared at load) and a failed NPC route search is retried after 1 s instead of every tick.

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

Bots: `complete`, `newbie`, `idle` (stays at the quartermaster), `evade-only`. Time bands are **provisional**; recalibrate on the first green single-seed run (staging §6, never padded).

> PO 10-09: at most one single-seed complete-bot pass per level is a gate; fun/feel is judged by the PO.

| ID | Criterion | Verification |
| --- | --- | --- |
| E22-AC01 | The L4 mission graph (ride → quartermaster → hold the plaza → find cover → bar the basement door) is structurally completable (E12-AC07) and has no fail timer | sim |
| E22-AC02 | The `complete` bot finishes L4 on **one seed** from `L4-default` (bat, axe, handgun) without cheats; sim time **4:20–7:40** (CHANGED 2026-10-12 l4-collapse: the war now lasts ~3 min until "Fall back!") PO 10-09: single seed. | sim |
| E22-AC03 | The `newbie` bot finishes one seed without cheats with deaths ≤ 2 (PO 2026-10-09: 20-seed batteries retired as gates) PO 10-09: single seed. | sim |
| E22-AC04 | **Convoy ride:** the player is seated (`vehicle.entered{role:'passenger'}`) in a bus of a 5-vehicle convoy that passes the army gate and reaches the plaza in 20–35 s; player control returns ≤ 0.5 s after the bus stops | sim |
| E22-AC05 | **False safety:** from level start until `l4.firstTurn`: zero infected entities, zero `combat.*` events, zero damage decals/corpses/wrecks/broken windows in `D-FAIR`; ≥ 40 civilians in non-idle routines (none idle facing nowhere > 3 s), ≥ 6 lit open shopfronts, ≥ 16 soldiers on posts | sim + static |
| E22-AC06 | **Machine gun:** acquired only from the quartermaster and auto-equipped; 2,000 continuous rounds never produce a reload, empty, overheat or ammo HUD element; pierce 1 (≥ 1 round hits two infected in line in the table test); clearing a group of 5 infected at 10 m takes ≤ 3 s with the machine gun and ≥ 6 s with the handgun; the `complete` bot's kill rate while firing during the plaza defense is ≥ 1.0 kills/s (median) | sim |
| E22-AC07 | **CHANGED 2026-10-13 (PO: "Keep the civilians like usually, just let Zombies flood in") — The alarm:** `l4.firstTurn` fires 40–50 s after the machine gun is issued (or arrival + 100 s); new infected enter from street emergence points and inside camp buildings. At alarm + 5 s, ≥ 90% of pre-alarm camp civilians remain human and panic/hide (high and low). Existing civilians turn only after a real bite; collapse pressure spawns new infected. Preserve the three collapse beats, Alpha counts and line-break timing. | sim |
| E22-AC08 | **Scale:** 18–22 soldiers and **60–70** civilians at the turn (high tier; 40 residents + 24 evacuees, CHANGED 2026-10-12 l4-collapse), ≥ 40 % of civilians armed with each of pistol, hunting rifle and improvised melee present ≥ 3 times; the low tier spawns 50 % of each count; infected ≤ 120 / 60 and total characters ≤ 190 / 95 are never exceeded | sim |
| E22-AC09 | **CHANGED 2026-10-11 — Everyone fights and everyone can turn:** retain ≥ 15 % armed-civilian share of non-player kills, civilian panic, same-id/clothes turning with dropped weapons, and no immunity/scripted survival. A panicking civilian crossing a soldier’s firing segment suppresses that shot until clear, without friendly-fire damage; the alarm preserves civilians and introduces new infected (AC07). One seed. | sim |
| E22-AC10 | **From all sides, without omniscience:** from turn + 30 s, director infected emerge from ≥ 3 street edges ≥ 60° apart, each first visible within 3 m of an emergence point outside the frustum; the E20-AC11 omniscience audit passes (one seed) PO 10-09: single seed. | sim |
| E22-AC11 | **Military spectacle:** per run, ≥ 2 HMG positions fire (`hmg.burst`), 2 military trucks and 1 armored vehicle are present, the tank enters and fires every 8–12 s through E27 large `ExplosionDef`s (never within 15 m of the player or an ally), the helicopter orbits with door-gun bursts and withdraws at `l4.lineBreaks` without landing | sim |
| E22-AC12 | **CHANGED 2026-10-11 — First Alphas, still not enough (count CHANGED 2026-10-13, PO "add more alphas"):** 6–8 `inf.alpha` (8 high, 6 low) spawn staggered after the first turn from ≥ 6 directions, within AC08 caps, and ≥ 3 reach a line or a nest (single idle seed); none in L1–L3. They use E07 resistance/knockdown/barricade rules. In the line fixture ≥ 2 soldiers fire at one visible Alpha for ≥ 3 s and ≥ 3 regular infected cross its opened defensive gap. By `l4.lineBreaks`, combined kills/downings ≥ 60; soldiers never increase, every loss is a bite/kill event. Shared world-space health bars and all four special moves meet E07, including phone readability. One seed. | sim + visual |
| E22-AC13 | **CHANGED 2026-10-12 (l4-collapse) — Three lines fall on beats:** the collapse director breaks line 1 (the sandbag runs) between 50 and 62 s after the turn, the gun nests between 110 and 124 s, the armour (tank swarmed, silent) between 170 and 182 s; a line breaks early (never before its window) when half its soldiers are down, and it is forced at the end of the window. 8 s after the third, the radio orders "All units, fall back!" and `l4.lineBreaks` (cause `beats`) triggers the E27 fuel-truck mega chain and objective "Find somewhere to hide". The beats keep their windows with the courier idle and with an optimal machine gunner. Soldier accuracy and damage are never changed. Separately, an Alpha physically destroys an E26 sandbag/barricade slot by logged HP damage (controlled line fixture and in the war); the gap becomes traversable with no scripted deletion. | sim |
| E22-AC14 | **Live damage:** at basement entry the district shows ≥ 4 fires, ≥ 2 burning vehicles, ≥ 10 shattered windows and ≥ 6 scorch decals, each traceable to an explosion/fire event of this run; corpses persist (E07-AC14) | sim |
| E22-AC15 | **CHANGED 2026-10-11 — Hardware basement, alone:** only the player enters Kessler’s Hardware basement (the existing immortal corgi may accompany them: orchestrator default; zero human followers). After `l4.doorBarred`, no human NPC or infected is inside; gunfire/explosions continue above for ≥ 6 s with the low-pass applied; then `level.completed` loads L5 inside the same basement with the carried arsenal and no reward screen. | sim + e2e |
| E22-AC16 | **Light:** `timeOfDay.L4.polar` in 1.15–1.30 rad and fog far ≥ L3 fog far + 20 m; 0 smoke columns before `l4.firstTurn` and ≥ 3 at `l4.lineBreaks` (`l4-collapse` frame) | unit + visual |
| E22-AC17 | **CHANGED 2026-10-13 (PO L4 round: checkpoints keep progress across deaths; "Keep the civilians like usually, just let Zombies flood in") — Checkpoints:** `arrival` restores the pre-war snapshot. During war/collapse, deaths at `turn`, `line-1`, `nests`, `armor`, and `line-break` return the player to the reached anchor while preserving the live battlefield, collapse clock, lost lines and actor state. No respawn reset or mass civilian conversion; armed-civilian losses during the delay must be bounded by recorded live bite/infection sequences. | sim |
| E22-AC18 | **Real-input playthrough:** headless Playwright, mouse/keyboard only, from the bus to the barred basement door, 1 seed, 0 console errors, screenshots at all §6 photo spots and the four pair cameras | real-input e2e |
| E22-AC19 | **Vision review** (checklists A, D, G, H): `l4-plaza-safe` reads "we actually escaped" (clean, intact, alive; contrast against `l3-grove-boulevard`); `l4-war-line` reads "huge mixed war scene"; `l4-tank` and `l4-collapse` read "war zone — everyone is fighting and it is still not enough"; the player stays readable inside the battle (checklist D). Each ≥ 7/10, no P0/P1 | vision |
| E22-AC20 | **Performance and tier scaling:** `perf-l4-war` (the peak once the first Alphas are in, 84 s after the turn: the surviving soldiers firing — the army loses men on the beats, l4-collapse design approved by the PO, "ok let's try that!" — ≥ 40 civilians, ≥ 80 infected, tank shot + helicopter + HMG tracers) holds the E18 high budgets (draw calls ≤ 600, triangles ≤ 1.5 M, sim p95 ≤ 4 ms, smoke ≤ 6k / debris ≤ 120, hero lights ≤ 8 (3 shadowed), awake props ≤ 150); the low tier at its scaled counts holds the low budgets; no frame > 50 ms at `l4.firstTurn`, any tank shot, the fuel-truck chain or `l4.lineBreaks` (perf trace) | perf |

## 9. Notes for implementers
- Biggest risk: simulated ally gunfire at this scale. Allies pick targets from the spatial hash at ≤ 4 Hz and resolve shots as hitscan rolls (no projectile bodies); tracers are pooled view-only ribbons.
- Turned soldiers drop their rifles as props (no infected uses weapons).
- E08's density table (L4 = 12) is superseded for L4 by §5.4; update the E08-AC11 fixture when L4 is built.

## 10. Implementation notes and deviations (lane build, 2026-10-09)
- **E22-AC06:** the handgun needs about 3.0 s for five infected at 10 m (10 shots at 3/s), the machine gun about 1.3 s, so the test asserts `handgun >= 2x machine gun` instead of an absolute 6 s.
- **E22-AC03 / AC12:** the 20-seed batteries are dropped as gates (PO 10-09). AC03 is a single-seed newbie-bot test, AC12 a single-seed check (soldiers do not grow, >= 60 kills by the break); the "infected >= 1.5x" median rule is not tuned.
- **Convoy:** vehicles are scripted rigid set pieces (`kind: 'setpiece'`, manifest asset ids), driven along `l4Route()`; the army checkpoint kit was replaced by prop dressing at the gate (its 3 m chicane blocks buses). The HMG on the APC became two sandbag nests.
- **Machine gun:** `weapon.army-mg` is a separate action from E06's `weapon.machine-gun` (tier 0, pierce 1, no ammunition).
- **Tank:** enters 22 s after the first turn so that it fires inside the war phase; targets are clusters >= 3 (falls back to 1) at least 15 m from the player and allies.
- **Mission graph:** custom (ride, quartermaster, hold, hide, bar, wait); no timers; the old L4 tests were retired and replaced by `tests/levels/L4.test.ts` and `tests/unit/levels/l4-static.test.ts`.
- **Helicopter:** rotors spin (render only); the door-gun bursts are events.
- **Tier counts:** scaled by the tier (low: soldiers 10, civilians 8, infected cap 60).
- **Perf (E22-AC20):** high p95 9.4 ms (war) / 11.7 ms (collapse), 255 / 282 draws, 464k / 1.11M triangles; phone (4x CPU throttle) p50 20.8 / 26.9 ms, 205 / 176 draws, 239k / 498k triangles. The phone hitch bound is 80 ms under the 4x throttle (50 ms on desktop). The perimeter posts and 30k+ triangle buildings no longer cast shadows on the phone tier.
- **Missing assets (none built, closest used):** a dedicated broken-glass decal, a fuel-truck crater, a cellar prop kit and a tank-shell scorch use existing assets / plain geometry.
- **Pre-existing on main (not caused by L4):** `T-E10-02` (L1 fire-station reachable at W0) and `T-E12-07-L1`.

## 11. Implementation plan (2026-10-11)

All lanes ≤ 3 h; execute in order. Keep the built convoy, quartermaster, armed-civilian mix, military spectacle, live damage and pair cameras.

| Lane | Budget | Concrete change and reuse |
| --- | --- | --- |
| L4-S1 systems | 3 h | Consume E07 Alpha data/brain, shared world-space bars and four specials/cooldowns, and E26 `src/sim/interact/Barricades.ts`; extend `src/sim/outbreak/Allies.ts` visible-target priority and civilian shot blocking. |
| L4-D1 district | 2 h | Reuse `src/levels/L4/layout.ts`, `D-FAIR`, `prop.sandbag-pallet`, `veh.military-apc`, `veh.tank`, `int.basement-cellar`; attach Alpha emergence and breakable-line anchors. |
| L4-E1 encounters | 3 h | Extend `src/data/l4.ts`, `src/sim/missions/LevelFourWar.ts` and `L4Spectacle.ts`: 2–3 Alphas, concentration/gap fixture, player-only basement handover. |
| L4-Q1 Scene Lab + browser e2e | 3 h | Extend existing `specs/scenes/qa-l4-*.json` with Alpha/line-break captures and `tests/levels/L4.test.ts`; headless `tests/e2e/levels/L4.spec.ts`, pair cameras and E18 peak counters. |

Epic report rationale: AC09/12/13/15 changed because the PO adds Alphas and explicitly requires an internal outbreak and solitary hardware-basement escape. Matching built content remains; §10 measurements must be revalidated with Alphas. Tests keep `T-E22-01`…`T-E22-20` and their AC tags; a matching old tag is not proof of the revised behavior.


### PO correction — 2026-10-12 alarm visibility

> "L4 alarm is there, but no Zombies anywhere"

The first war stream starts with the alarm (superseding the old 28 s empty prelude). Nearby authored building doors feed the first wave; later streams retain the perimeter ring. A real-input browser check must show living infected on screen within 10 s of the alarm. Counts and military weapon strength remain unchanged.
