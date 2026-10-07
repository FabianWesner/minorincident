# E21 · Level 3: The Police Collapse

> **Rewritten 2026-10-07 per product owner** (`po-levels-2-6-2026-10-07.md`, which wins on any disagreement). E21 was marked **done** for the OLD L3 "Reach the Safe Zone" (12-minute timer, sedan driving tutorial, supermarket/park route choice, half-overrun checkpoint, Civic Center safe-zone twist). **That content is superseded** and E21 is back to `todo`. Its systems are **reused**: the L3 mission builder and encounter scaffolding (`src/levels/L3/`), vehicles (E09), checkpoints, the deadline system (unused here, kept for other content), the D-MAIN/D-SHOP/D-CIVIC geometry as building stock. Old tests tagged `@E21-AC01…AC09` describe the old level: re-tag them to a regression suite id (e.g. `@L3-legacy`) or retire them together with the old `levelThreeMission`; **the new E21-ACxx IDs below are not the same criteria**.

## 1. Goal

A ~5-minute, **more linear and more action-heavy** level. It starts at the police-controlled bridgehead where L2 ended. The player gets the first proper ranged weapon, a **handgun**, fights alongside organized, armed police when the **police station is attacked**, and has to leave when the attack becomes too large. **Three or four officers** come along. The level runs forward through **three parallel streets** (residential, shopping, main road) in late-afternoon light as the city visibly begins to collapse; the player can switch streets but must keep moving. Armed police nearby feel unusually safe at first; then the infected numbers grow and the squad is separated, overwhelmed, bitten, killed or turned. Medkits keep the action from becoming an attrition death. The level ends at a much stronger **army checkpoint**.

Emotional arc: **strong squad → dangerous journey → squad gets reduced → player increasingly alone.** Escalation position: **the police fight openly, and the city is collapsing.**

## 2. Depends on / Enables

E20 (allied fighters v1, outbreak rules §5.1, bridge checkpoint), E06 (handgun, §5.2), E07, E08 (followers: the escort follow behavior without a mission fail), E10 (W2→W3 layers), E11 (medkit pickups), E12, E14, E16, E25 (`L3` preset, police light bars, fires), E26 (makeshift barricades as cover), E27 (fires, smoke columns, wrecked vehicles) / **E22** (starts in the evacuation convoy that leaves this checkpoint), M2 exit.

## 3. Scope

**In:** the police station yard and bridgehead start; the handgun pickup; the station-attack set piece; **allied fighters v2** (police with handguns, a following squad, §5.4); firearms as loud events (§5.3); the linear three-street corridor district `D-CORRIDOR` with per-street damage; escalating density; medkits; the army checkpoint and its evacuation buses; the `L3` late-afternoon preset; photo spots, bots and tests.

**Out:** player driving and route-choice timers (old L3); special infected archetypes (orchestrator default: turned humans only, incl. turned police); throwables; an ammunition system (none in the game, 00 §6.1).

## 4. Level structure and story beats (~5 min)

| # | Beat | Location | What happens | Target time |
| --- | --- | --- | --- | --- |
| 1 | Behind the line | east bridgehead and **Sunset Grove Police Station** yard (`D-CORRIDOR` south end, `bld.police-station`, `kit.police-bridge-checkpoint` from L2 seen from the inside) | The gate from L2 is closed behind the player. 8–10 officers hold the yard: sandbags, cruisers with light bars, a sergeant briefing, an armory table. Officers are organized, armed, confident. Free movement. | 0:00–0:20 |
| 2 | Handgun | station armory table | Objective: **Take a handgun from the armory**. Stand-to-interact 0.6 s / `E`: the handgun is added to the carried weapons and auto-equipped (HUD swap, short stinger). Sergeant: *"Point, squeeze. Aim for what's closest."* | 0:20–0:35 |
| 3 | The station attack | station yard, perimeter fences, river path | Infected attack from ≥ 3 directions (river path, two streets) in growing waves (emergence rules). Officers fire from cover; the player fights alongside them. Officers get grabbed, bitten, turned. Objective: **Help defend the station**. | 0:35–1:35 |
| 4 | Too large to hold | yard → corridor entrance | Fallback (`l3.fallback`, §5.5). Sergeant: *"We can't hold this! Army checkpoint, up the avenues — you're with us!"* **3–4 officers** join the player as a squad. Objective: **Reach the army checkpoint**. | 1:35–1:45 |
| 5 | Strong squad | corridor segment 1 (0–100 m) | Low density. The squad shoots most infected before they come close. The player feels unusually safe. First medkits. | 1:45–2:30 |
| 6 | Dangerous journey | segment 2 (100–220 m) | Density rises; gunfire draws groups (loud events); side streets spill infected; officers get separated around wrecks and barricades; first squad losses. The player switches streets to avoid the worst. | 2:30–3:40 |
| 7 | Increasingly alone | segment 3 (220–320 m) | Highest density; the remaining officers are overwhelmed or turn; the player is mostly alone, running from cover to cover, picking up the last medkits. | 3:40–4:40 |
| 8 | Army checkpoint | north end of the corridor at the highway on-ramp (`kit.army-checkpoint`, `kit.highway-onramp`) | Soldiers behind heavy barricades cover the last 20 m; military vehicles; **evacuation buses full of civilians**; loudspeaker announcements. The player crosses into the army-controlled zone → level ends; L4 starts on one of these buses. | 4:40–5:00 |

**Checkpoints:** `armory` (after the handgun), `fallback` (squad formed), `segment-2`, `segment-3`. Respawn restores the snapshot (squad members alive at the checkpoint come back).

**No fail timer.** Forward pressure comes from the content: director emergence behind the player's furthest progress line grows while the player lingers (§5.6).

## 5. Systems

The E20 §5.1 outbreak rules apply unchanged (sight-only, no omniscience, bites turn everyone incl. police, identity continuity, emergent snowball).

### 5.1 Map: `D-CORRIDOR` (linear, three parallel streets)
- Length **280–340 m** (south bridgehead → north on-ramp), width ≈ 75 m. Three parallel streets ≈ 22 m apart, separated by building rows, all heading the same direction:
  - **Oak Avenue** (residential): damaged gardens, abandoned houses with open doors, crashed cars, makeshift barricades (furniture, cars), blood and bodies.
  - **Commerce Street** (shopping): broken shop windows, looted stores, scattered merchandise, abandoned bags, damaged/hanging signs.
  - **Grove Boulevard** (main road): wrecked buses, abandoned police vehicles, a traffic jam, stronger signs of fighting (sandbag remains, casings, a burned cruiser).
- **≥ 6 cross-links** between neighboring streets (alleys, pass-through shops, parking lots), spaced ≤ 60 m, so switching streets is always possible but the general direction stays forward.
- Sight blockers every ≤ 25 m on every street; no dead ends longer than 30 m; visible-geometry edges only (E19 route rules).
- Reuses house/shop/building stock from D-RES, D-MAIN, D-SHOP with W2/W3 dressing (orchestrator default for production cost — PO may change).

### 5.2 Handgun (E06 rule, introduced here)
- Single-target ranged weapon: 20 damage (2 hits per 40 HP infected), range 22 m, 3 shots/s, no pierce (max 1 target per shot), soft aim assist (00 §5.1).
- **No ammunition system:** no magazine counter, no reload, no reserve, no ammo pickups; the fire rate is the only limit (orchestrator default for "no ammunition" — PO may change to a cosmetic reload rhythm with infinite reserve).
- It does not replace the axe's crowd clearing: the bat and the axe stay carried and selectable.

### 5.3 Gunfire is a loud event (firearms only; orchestrator default)
Each player or ally gunshot is a deliberate loud event (like the L1 car alarm, E19 §5.3): non-chasing infected within **20 m** (handgun) move to a random point within 3 m of the **shot position** and search there (E19 search behavior). They never receive the shooter's live position; seeing a human overrides it. Melee stays silent. This is how fighting attracts more infected without omniscience.

### 5.4 Allied fighters v2: police
- **Station officers (8–10):** HP 100, handguns (15 damage, 1.5 shots/s, 60 % hit chance at ≤ 15 m falling to 25 % at 22 m), fire from cover positions, never leave the yard before the fallback.
- **The squad (3–4):** the living officers designated as squad (they start near the armory, so 3–4 are normally alive at the fallback; they are not protected). Follow the player at 2–6 m (E08 escort follow, **no mission fail on death**), engage visible infected within 18 m automatically, keep ≤ 20 m from the player when not engaged, regroup when the player moves on. **Allies never teleport** to catch up (orchestrator default) — separation is real.
- Officers can be grabbed, bitten and turned exactly like civilians (E20 §5.1); a turned officer keeps his uniform and hunts.
- Player weapons never damage officers or civilians; officers never damage humans.

### 5.5 Station attack and fallback
- Waves from ≥ 3 directions, escalating (orchestrator default: 6, then 12 at +20 s, then 20 at +40 s; all via emergence points outside the frustum).
- `l3.fallback` fires at the first of: 60 s of defense, ≥ 3 officers turned, or ≥ 8 infected inside the yard fence. The non-squad officers stay and keep fighting (and fall).

### 5.6 Density and pressure
- Pre-populated wanderers per segment (orchestrator default): S1 ≈ 10, S2 ≈ 25, S3 ≈ 40 (±20 %), spread over the three streets in groups; plus everything the gunfire attracts and everyone who turns.
- **Forward pressure:** while the player stays behind their furthest progress line for > 20 s, the director lets 1–3 infected emerge from doors 15–35 m *behind* that line every 10 s (E19 emergence rule). No timer, no invisible wall.
- Caps: concurrent infected ≤ 80 (high) / 40 (low); at the cap bites kill.

### 5.7 Medkits
- `pick.medkit`: walk-over pickup, +40 HP (capped at max), removed on pickup. Placement: 1 at the armory, **≥ 2 per street** (≥ 7 total), biased to S2/S3 and to cross-link mouths.
- Out-of-combat regen (00 §4) still applies.

### 5.8 Environment: W2 → W3 "recently collapsed, still recognizable"
Noticeably more than L2: ≥ 6 fires (≥ 1 per street, E27 small/medium), ≥ 12 corpses, ≥ 15 wrecked or abandoned vehicles (≥ 2 wrecked buses and ≥ 3 abandoned police vehicles on Grove Boulevard, a traffic jam of ≥ 8 cars), broken glass on every shop frontage of Commerce Street, ≥ 2 smoke columns visible from every street. Still **no** collapsed buildings or rubble-filled streets (W5 is reserved for L5).

### 5.9 Lighting, weather, sound
- Preset `L3` (late afternoon): lower, warmer sun (polar 1.00–1.20 rad, sun hue 25–45°), **longer shadows** (≥ 1.6× the L2 length), harsher contrast, warmer smoke haze in the fog; E28 (optional): smoke haze and gusts carrying ash.
- Sound: gunfire with distance cues, police radio (dispatch going silent over the level), sirens fading, the chaos layer scaling with infected count.

### 5.10 Army checkpoint and transition
≥ 8 soldiers (allied fighters, rifles; they hold position and cover the last 20 m), heavier barricades than the police line (concrete T-walls or bastion walls, sandbag nests, razor wire), ≥ 2 military vehicles (`veh.military-truck` + a light military vehicle), **≥ 2 evacuation buses with seated civilians visible**, loudspeaker lines (*"Keep moving. Buses to Fairhaven. Keep moving."*). Crossing the zone line fires `level.completed`; the campaign continues straight into L4 (no reward screen), loadout carried (bat, axe if taken, handgun).

## 6. Photo spots
`l3-station-yard` (organized police), `l3-station-attack`, `l3-squad-strong` (player + 4 officers firing in segment 1), `l3-oak-avenue`, `l3-commerce-street`, `l3-grove-boulevard`, `l3-alone` (player with ≤ 1 officer, segment 3), `l3-army-checkpoint` (same framing scale as `l2-bridge-checkpoint`).

## 7. Bruno references
- [`World/VisualVehicle.js`](../folio-2025/sources/Game/World/VisualVehicle.js): cruiser light bars, abandoned vehicles
- [`Trails.js`](../folio-2025/sources/Game/Trails.js): tracer ribbons for handguns
- [`Tornado.js`](../folio-2025/sources/Game/Tornado.js): smoke column pattern
- [`Objects.js`](../folio-2025/sources/Game/Objects.js): makeshift street barricades

## 8. Acceptance criteria

Bots: `complete`, `newbie`, `evade-only`, `idle` (stays in the station yard). Time bands are **provisional** and are recalibrated on the first green 20-seed run (staging §6, never padded).

| ID | Criterion | Verification |
| --- | --- | --- |
| E21-AC01 | The L3 mission graph (armory → defend station → fallback → reach army checkpoint) is structurally completable (E12-AC07) and has no fail timer | sim |
| E21-AC02 | The `complete` bot finishes L3 on **20/20 seeds** from the `L3-default` progression (bat + axe) without cheats; median sim time **2:00–3:45** | sim |
| E21-AC03 | The `newbie` bot finishes on ≥ 18/20 seeds, median sim time **2:30–4:30**, median deaths ≤ 2 | sim |
| E21-AC04 | **Handgun:** acquired only at the armory (the `complete` bot has it within 40 s of start); each shot hits at most 1 target (no pierce), a 40 HP infected needs 2 hits, range 22 m; 600 continuous shots never produce a reload, an empty state or an ammo HUD element; bat and axe remain selectable | sim + e2e |
| E21-AC05 | **Ranged before contact:** in `complete` runs the median distance of handgun kills is ≥ 6 m, while axe/bat kills are ≤ 2.5 m (the weapons have different roles) | sim |
| E21-AC06 | **Gunfire loud events:** a shot pulls every non-chasing infected within 20 m to within 4 m of the shot position within 10 s, then they search; infected beyond 20 m or already chasing are unaffected; the E20-AC11 omniscience audit passes over 20 `complete` runs | sim |
| E21-AC07 | **Station attack:** 8–10 armed officers defend from cover; waves come from ≥ 3 directions ≥ 60° apart; ≥ 1 officer is bitten and turns (same entity id, uniform) during the attack on ≥ 15/20 seeds; `l3.fallback` fires by its first-of rule (60 s / 3 turned / 8 inside), and with the `idle` bot it still fires (the station cannot be held indefinitely) | sim |
| E21-AC08 | **Squad forms:** at the fallback 3–4 living officers join as followers on ≥ 19/20 seeds; no officer has a damage-immunity or scripted-survival flag at any tick | sim |
| E21-AC09 | **Squad feels strong first:** in segment 1, officers make ≥ 60 % of infected kills and the player's median damage taken is ≤ 15 HP (20 `complete` seeds); squad members stay within 8 m of the player ≥ 80 % of non-combat time and never teleport (no position jump > 1 m per tick) | sim |
| E21-AC10 | **Squad falls apart (systemically):** the median squad size at the ends of segments 1, 2, 3 is non-increasing and is ≤ 2 at the army checkpoint; all 4 arrive on ≤ 15 % of seeds; ≥ 1 officer turns during the corridor on ≥ 50 % of seeds; every squad loss is a `bite`/`combat.kill` event or a separation > 40 m (no scripted removal) | sim |
| E21-AC11 | **Linear corridor layout:** length 280–340 m, three parallel streets, ≥ 6 cross-links spaced ≤ 60 m, sight blockers every ≤ 25 m, no dead end > 30 m; the `complete` bot's progress coordinate never regresses by > 15 m, and on each of three forced-street runs (one per street) it completes on 20/20 seeds | sim (layout + sim) |
| E21-AC12 | **Escalation:** pre-populated infected per segment are within ±20 % of 10 / 25 / 40; the median live infected count within 30 m of the player rises from segment 1 to segment 3; caps 80 (high) / 40 (low) are never exceeded | sim |
| E21-AC13 | **Forward pressure:** when the player idles 20 s behind the furthest progress line, emergence behind that line starts (1–3 infected per 10 s from doors 15–35 m behind, outside the frustum) and stops when the player advances | sim |
| E21-AC14 | **Medkits:** ≥ 2 per street and ≥ 7 total; a pickup restores 40 HP (capped) and is consumed; the `newbie` bot picks up ≥ 2 per run (median); the time-weighted share of the `newbie` run spent below 20 % HP is ≤ 10 % | sim |
| E21-AC15 | **Per-street damage:** the static dressing manifest gives each street its type set (Oak: gardens/abandoned houses/crashed cars/barricades/bodies; Commerce: broken windows/looted stores/merchandise/bags/damaged signs; Boulevard: ≥ 2 wrecked buses, ≥ 3 abandoned police vehicles, ≥ 8-car jam) and the §5.8 totals (fires ≥ 6, corpses ≥ 12, vehicles ≥ 15), and zero collapsed/rubble assets | static |
| E21-AC16 | **Late-afternoon light:** `timeOfDay.L3.polar` in 1.00–1.20 rad, sun hue 25–45°; the 1.8 m probe's shadow at `l3-grove-boulevard` is ≥ 1.6× its L2 length (shadow-mask measurement); ≥ 2 smoke columns are in frame at every street photo spot | unit + visual |
| E21-AC17 | **Army checkpoint and transition:** ≥ 8 soldiers, heavier barricades than the L2 police line (T-walls/bastions + sandbag nests), ≥ 2 military vehicles, ≥ 2 buses with seated civilians; crossing the zone line fires `level.completed` and the campaign loads L4 (on the bus) with the carried loadout and no reward screen | sim + e2e |
| E21-AC18 | **Checkpoints:** dying right after `armory`, `fallback`, `segment-2`, `segment-3` restores the snapshot (squad members, outbreak layer, picked medkits stay picked) within tolerance | sim |
| E21-AC19 | **Real-input playthrough:** headless Playwright, mouse/keyboard only, from the yard through the station attack and one street to the army zone, 1 seed, 0 console errors, screenshots at all §6 photo spots | real-input e2e |
| E21-AC20 | **Vision review** (checklists A, D, E, G): `l3-station-yard` reads "organized, armed, capable police"; `l3-squad-strong` reads "unusually safe"; the three street spots each read their damage type and "recently collapsed but recognizable" (more damage than `l2-streets-w1`); `l3-alone` reads "increasingly alone"; `l3-army-checkpoint` reads clearly stronger than `l2-bridge-checkpoint`; late-afternoon light reads warmer and longer than L2. Each ≥ 7/10, no P0/P1 | vision |
| E21-AC21 | **Performance:** high and low tiers hold the E18 budgets at `l3-station-attack` (8–10 officers firing + ≥ 30 infected) and `l3-grove-boulevard` (fires, smoke columns, wrecks); tracer and muzzle-flash pools stay within the particle caps; no frame > 50 ms at `l3.fallback` | perf |

## 9. Notes for implementers
- `src/levels/L3/` (old route-choice level) is the starting scaffold: keep the builder pattern, replace the content. The old `deadline` stays supported by E12 but is not used.
- The squad uses the E08 escort follower with `failOnDeath: false` plus the E20 allied-fighter combat brain.
- E08's per-level density table (L3 = 24 ambient civilians) is superseded for L3 (few civilians: stragglers in houses and the bus passengers at the checkpoint); update the E08-AC11 fixture when L3 is rebuilt.
