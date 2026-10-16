# E23 · Level 5: Aftermath

> **Updated 2026-10-11 per product owner** (`po-levels-4-9-2026-10-11.md`, which wins on any disagreement). Matching built content remains. Changed criteria are marked **CHANGED 2026-10-11**; §10 is historical implementation evidence. This replaces the previous L5 "Hold the Line" (convoy HP, four fallback positions, gas-station mega hazard, the bridge blown early). That content is superseded; its systems are reused (escort follower, barricade props, decay layers, mega-blast sequencer for E22).

## 1. Goal

A ~5-minute, deliberately **quiet** level in the **same streets as L4**, hours later, at **sunset**. The player climbs out of the Kessler's Hardware basement into a Fairhaven that is now genuinely devastated: the same recognizable buildings, burned, shot up, partly collapsed, with no soldiers, no crowds, no helicopters, no battle. A few infected wander the ruins. The player hears or discovers signs of life and **finds five survivors** hidden around the city, one by one; each joins and follows. The player, the only heavily armed protector, keeps the growing group (1 → 2 → 3 → 4 → 5) alive and leads whoever remains to the **Fairhaven Metro station**, a defensible shelter that has attracted other survivors.

Emotional outcome: **the war is over, and you walk through its silent aftermath.** L4 was deafening, L5 is almost silent; the impact comes from recognizing places the player saw intact or active an hour of play ago. Relationship: the player becomes **the primary protector of survivors**. The shotgun is found in the basement at start; the machine gun remains better for large groups.

> PO, verbatim: "At the start of the level, the player can find a shotgun in the hardware-store basement."
>
> "The player still has access to previous weapons, including the machine gun."
>
> "The shotgun has a distinct role:"
> - very strong single-target damage
> - excellent at close range
> - normal infected can be killed quickly
> - especially useful against Alphas
> - machine gun remains better against large groups
>
> "Inside the station, around 20 to 30 additional survivors have already gathered."
>
> "The level ends with the group entering the metro and the doors closing behind them."

## 2. Depends on / Enables

E06 (existing shotgun catalog), E07 (`inf.alpha`), E22 (`D-FAIR` and its pair cameras, machine gun, basement), E08 (escort follower without mission fail, survivor states), E10 (decay layer system: the `D-FAIR` W5 twin), E12, E14 (survivor counter), E16 (near-silence mix, positional cues), E25 (`L5` sunset preset, fire light), E27 (persistent fires, smoke columns, wreck variants), E28 (optional: still air, ash and embers) / **E24** (starts inside the metro station), M3.

## 3. Scope

**In:** the shotgun pickup inside the basement at start and the basement exit; the devastated `D-FAIR` W5 twin (same layout, damaged assets); sparse infected including 1–2 Alphas; the five hidden survivors with discovery cues; the escort group with no fail state; the metro station entrance as destination; the `L5` sunset preset with a gloom ramp; the near-silent sound arc; L4/L5 pair photo spots; bots and tests.

**Out:** additional weapon introductions beyond the shotgun; hordes, waves or director horde spawns (sparse by design); ally fighters (none survive); survivors with weapons (orchestrator default: all five are unarmed — PO may change); fail on survivor death (PO: the level continues).

## 4. Level structure and story beats (~5 min)

| # | Beat | Location (`D-FAIR`, W5 twin) | What happens | Target time |
| --- | --- | --- | --- | --- |
| 1 | Emerging | Kessler's Hardware cellar → Kessler Lane | The level begins inside the basement beside a findable shotgun; previous weapons remain selectable. Caption *"Hours later."* (orchestrator default). The player unbars the door and steps out at `pair-kessler-lane`. Silence: wind, crackling fire, a distant collapse. No objective for ~10 s, then: **Look for anyone still alive**. | 0:00–0:20 |
| 2 | Recognition | Harbor Street → Reception Plaza | The streets from L4, now empty: burned-out cars, the wrecked tank and trucks, blown sandbag lines, the fuel-truck crater, corpses (many in uniform), scattered weapons and belongings, smoke, fires still burning. A few infected wander. | 0:20–1:00 |
| 3 | Five survivors | five hiding places across the district (§5.3) | Each survivor gives a **sign of life** (voice, knocking, a blinking flashlight, chalk "ALIVE INSIDE", a radio). The player finds them in any order; stand-to-interact (1.0 s) → *"You're… real. Take me with you."* → the survivor follows. HUD: **Survivors found n/5**. Every encounter is more tense with more people to protect. | 1:00–3:45 |
| 4 | To the metro | plaza → Lakeshore Avenue → **Fairhaven Metro** entrance | When all five are accounted for (found, dead or turned), objective: **Lead the survivors to the metro station**. A lookout behind the half-open shutter waves them in with a flashlight. | 3:45–4:45 |
| 5 | Shelter | metro entrance stairs | The player and the living followers go down into the station, where 20–30 additional survivors are already present; the doors visibly close behind them. `level.completed`; L6 starts inside the station. | 4:45–5:00 |

**Checkpoints:** `outside` (after leaving the basement), after each survivor found (`survivor-1` … `survivor-5`). **No fail timer; no fail on survivor death.**

## 5. Systems

E20 §5.1 outbreak rules apply (sight-only, no omniscience, bitten survivors turn with identity continuity). Machine-gun loud events (30 m, E21 §5.3) pull nearby wanderers to the shot position: every burst has a cost.

### 5.1 `D-FAIR` W5 twin (same city, devastated)
- **Same layout:** identical road graph, nav topology (except debris blocking ≤ 3 street segments, each with a detour), and building transforms as L4. Every L4 hero building and every street-facing building has a devastated variant at the same transform; footprints match.
- **Damage (minimums):** ≥ 10 burned-out cars, ≥ 3 wrecked military vehicles (incl. the tank and an HMG vehicle), ≥ 6 fires still burning, broken windows on ≥ 70 % of street frontages, collapsed or heavily damaged facades on ≥ 4 buildings, bullet-damage decals on every plaza facade, ≥ 4 smoke columns, ≥ 30 corpses (≥ 10 in uniform), scattered weapons and belongings, destroyed barricades (blown sandbag lines, abandoned nests, the fuel-truck crater).
- **Nothing active:** no living soldiers or civilians (except the five hidden survivors, the metro lookout and 20–30 people already inside the station), no helicopters, no vehicles moving, no gunfire except the player's.

### 5.2 Infected (sparse)
12–20 infected at start in total, **including 1–2 Alphas** (orchestrator decision), spread in ones and twos (no group > 3), plus any survivor that turns. Both tiers keep 1–2 Alphas inside this sparse total. **No director spawns or emergence** in L5. Cap 30 (both tiers). Survivors and the player are equally valid targets (closest visible human).

### 5.2b Shotgun pickup and distinct role
- Reuse `weapon.shotgun` in `src/data/actions/catalog.ts`, `wpn.shotgun` and `icon.shotgun`: 240 total damage per shell (8 pellets), 2 shots/s, 18 m maximum range; falloff begins at 8 m and reaches 0.1 at 10 m (PO #37, merged stopping-power update). No new weapon model or parallel combat system.
- A stand-to-interact pickup (0.6 s / `E`, orchestrator default) sits on an existing basement shelf within 3 m of the start; auto-equip on pickup, retain bat/axe/handgun/army machine gun. Findable before the basement exit, not a remote city pickup.
- Campaign use has no ammunition system: disable the catalog's reference magazine/reload, retain its firing cadence and pellet/falloff math (orchestrator default consistent with the campaign). Alpha damage and shot counts use E07's explicit table.
- In a no-upgrade fixture at ≤ 4 m with all pellets landing, one shell kills a normal 60 HP infected; two shells incapacitate the default 300 HP Alpha. The machine gun takes ≥ 4 s of landed rounds against that Alpha; shotgun takes ≤ 0.6 s. At 12 m the shotgun's per-shell damage is ≤ 10 % of its close-range damage. A spread group of 10 normal infected across a 10 m front at 10 m is cleared faster by the machine gun than by the shotgun (same deterministic aim script, ≥ 1.5× time ratio; orchestrator default).
- **PO precedence:** "normal infected can be killed quickly" requires actual shotgun kills in this fixture; a recoverable downing does not pass. This supersedes the older 2026-10-08 firearm-only-knockdown rule for normal shotgun targets in this updated campaign. Other weapons keep their existing recovery behavior; Alpha resistance checks measure HP depletion/incapacitation and do not introduce a boss death sequence.

### 5.3 Survivors and signs of life
- Five named survivors with existing character models in soot-and-bandage tint variants (orchestrator default casting — PO may change): **Dale** (mechanic, `npc.survivor-group`), **Rosa** (paramedic, `npc.paramedic`), **Mr. Okafor** (elderly, `npc.civilian-elderly`), **Mia** (shop clerk, `npc.civilian-woman-a`), **Sam** (hunter without his rifle, `npc.survivor-group`). All adults.
- Hiding places ≥ 25 m apart, at least 4 inside or behind buildings: the pharmacy back room, a wrecked bus on Lakeshore Avenue, the church vestry, an apartment stairwell above Harbor Street, the cab of a wrecked military truck.
- **Sign of life:** each place emits a cue the player can perceive within 25 m (positional voice/knocking with a subtitle and its direction, or a visual cue: blinking flashlight, chalk sign). No objective markers on survivors (orchestrator default); the HUD shows a direction ping for a heard cue for 4 s.

### 5.4 Escort group (the player as protector)
- Found survivors follow at 2–5 m (E08 escort follow, `failOnDeath: false`), single-file through narrow passages, run at 3.8 m/s (slower than the player's run and every infected), call *"Wait!"* when > 10 m behind; when an infected is within 8 m they crouch in cover.
- **Vulnerable:** unarmed; an infected that reaches a survivor grabs and bites (1.0 s rescue window for the player, E19 §5.1); a bitten survivor turns in 3.0 ± 0.5 s next to the group.
- Lost survivors are not replaced; the level continues and stays completable with zero survivors.
- Level end: the shutter closes when the player is inside the station trigger and every living follower is within 15 m or 10 s have passed; followers inside count as **rescued** (carried into L6). After the ingress grace period, still-living followers must actually cross the entrance before doors close; the 10 s grace triggers regrouping, not a door closing on people outside. The 20–30 station occupants exist before arrival and carry their exact ids/state into L6 (both tiers); no crowd is re-created at the cut.

### 5.5 Lighting and sound
- Preset `L5` (sunset): sun near the horizon (polar 1.45–1.55 rad), deep red/orange sun (hue 0–25°), red-to-violet sky, intensity ≤ 0.7× `L4`, long shadows; a **gloom ramp** lowers the sun intensity monotonically over the level (≥ 30 % darker at the metro than at the basement exit). Fires and the light field carry more of the image as the sun fades.
- **Silence, then music (PO 2026-10-15, verbatim: "Keep the music of L5. Start with silence, then play the current music after I got the 1st suvivor."):** silence until survivor 1 is found, then the current L5 music; ambience = wind, fire crackle, distant single collapses, an infected's breathing when near; no battle sounds. The mix makes every machine-gun burst feel loud.

## 6. Photo spots
The four pair cameras from E22 in the W5 state: `pair-plaza`, `pair-harbor-street`, `pair-metro-entrance`, `pair-kessler-lane`; plus `l5-shotgun-basement`, `l5-basement-exit`, `l5-sign-of-life`, `l5-group-of-five` (player leading 5 followers in sunset light), `l5-metro-shelter` (20–30 occupants visible inside), `l5-metro-doors-closed`.

## 7. Bruno references
- [`Tornado.js`](../folio-2025/sources/Game/Tornado.js): smoke columns over the ruins
- [`World/PoleLights.js`](../folio-2025/sources/Game/World/PoleLights.js): broken/dead lamps (power off), the lookout flashlight
- [`InteractivePoints.js`](../folio-2025/sources/Game/InteractivePoints.js): survivor interactions
- [`Cycles/DayCycles.js`](../folio-2025/sources/Game/Cycles/DayCycles.js): the sunset gloom ramp

## 8. Acceptance criteria

Bots: `complete`, `newbie`, `evade-only` (escorts but never attacks), `idle`. Time bands are **provisional**; recalibrate on the first green single-seed run (staging §6, never padded).

> PO 10-09: at most one single-seed complete-bot pass per level is a gate; fun/feel is judged by the PO.

| ID | Criterion | Verification |
| --- | --- | --- |
| E23-AC01 | **CHANGED 2026-10-11:** graph (optional basement shotgun → leave basement → find 5 in any order → enter metro → close doors) is structurally completable (E12-AC07), no fail timer or fail on survivor death. | sim |
| E23-AC02 | The `complete` bot finishes L5 on **one seed** from `L5-default` (machine gun) without cheats; sim time **2:00–4:00**; survivors rescued ≥ 4 PO 10-09: single seed. | sim |
| E23-AC03 | The `newbie` bot finishes on one seed, **2:30–5:00**, deaths ≤ 1, survivors rescued ≥ 3 PO 10-09: single seed. | sim |
| E23-AC04 | **CHANGED 2026-10-11 — Quiet aftermath:** zero allied fighters, helicopters, moving vehicles or non-player gunfire for the first 60 s; living civilians are only the five hidden survivors, lookout and 20–30 additional survivors already inside the station (both tiers). Total initial infected 12–20 includes 1–2 Alphas, no group > 3; no horde. | sim |
| E23-AC05 | **Same city:** the L5 composition uses the `D-FAIR` layout with an identical road graph; for every L4 hero building the L5 variant has the same transform and its top-down footprint mask has IoU ≥ 0.9 with L4; nav differs only by ≤ 3 debris-blocked segments, each with a detour ≤ 1.5× | unit (layout) |
| E23-AC06 | **Devastation:** the static W5 dressing manifest meets the §5.1 minimums (burned cars ≥ 10, wrecked military vehicles ≥ 3, fires ≥ 6, broken windows ≥ 70 % of frontages, damaged/collapsed facades ≥ 4, smoke columns ≥ 4, corpses ≥ 30 with ≥ 10 in uniform, destroyed barricades) | static |
| E23-AC07 | **Sparse, never omniscient:** no director spawn or emergence event fires in L5; concurrent infected ≤ 30; the E20-AC11 omniscience audit passes; machine-gun bursts pull non-chasing infected within 30 m to the shot position (E21-AC06 rule) | sim |
| E23-AC08 | **Signs of life:** each survivor's cue is perceivable (audio event with position + subtitle, or visual cue in frustum) within 25 m and not beyond 30 m; no objective marker points at an undiscovered survivor except the PO 2026-10-15 #21b guidance for Sam (visible blinking flashlight plus objective distance or minimap ring); the hiding places are ≥ 25 m apart and ≥ 4 are inside/behind buildings | sim + static |
| E23-AC09 | **Group grows and follows:** interaction (1.0 s) makes a survivor follow; the HUD counter steps 0 → 5 as found; followers stay within 8 m of the player ≥ 80 % of non-combat time, never teleport (no jump > 1 m per tick), and are slower than the player's run (3.8 m/s) | sim |
| E23-AC10 | **Protection matters:** an infected reaching an unprotected survivor bites within 1.5 s; a hit during the 1.0 s grab saves them; a bitten survivor turns in 2.5–3.5 s with identity continuity; the `evade-only` bot rescues a ≤ 2 survivors while `complete` rescues ≥ 4 (one seed) PO 10-09: single seed. | sim |
| E23-AC11 | **Losses don't stop the level:** force-killing 1, 3 or all 5 survivors at random points still lets the `complete` bot finish on one seed; the completion result data and the direct L6 handover report the rescued count (PO 2026-10-11: no reward/summary interstitial) PO 10-09: single seed. | sim |
| E23-AC12 | **CHANGED 2026-10-11 — Shotgun at start:** within 3 m of the basement start, `wpn.shotgun` pickup adds and auto-equips the existing catalog shotgun; all previous weapons remain selectable. In §5.2b fixtures one close shell kills a normal 60 HP infected, 2 shells incapacitate the default Alpha in ≤ 0.6 s (PO #37; Alpha HP/resistance unchanged) vs army-MG ≥ 4 s, 12 m falloff ≤ 10 %, and machine gun clears the spread group ≥ 1.5× faster. 600 shots show no reload/empty/ammo HUD. No other new weapon. | sim + e2e |
| E23-AC13 | **Sunset and gloom:** `timeOfDay.L5.polar` in 1.45–1.55 rad, sun hue 0–25°, intensity ≤ 0.7× `L4`; the sun intensity decreases monotonically over the level and is ≥ 30 % lower at the metro trigger than at the basement exit | unit + sim |
| E23-AC14 | **Silence until survivor 1 (PO 10-15):** no music cue before the first survivor is found; the current L5 music starts within 2 s after; the mix-bus loudness over L5's first 60 s (offline render) is ≥ 18 LU below the loudness of L4's war phase (`l4.firstTurn` → `l4.lineBreaks`); no battle-layer cues play in L5 | e2e (offline audio) |
| E23-AC15 | **CHANGED 2026-10-11 — Metro entrance, occupants, closing doors:** objective switches after all five are accounted for. The group physically enters; 20–30 additional people already inside are visible before doors close (both tiers). Every living follower crosses before closure; doors visibly reach closed state and block passage. `level.completed` carries rescued ids, station occupant ids/state and loadout into L6, without a reward screen. With zero rescued, the same handover remains completable. | sim + e2e + visual |
| E23-AC16 | **CHANGED 2026-10-11 — Checkpoints:** death after `outside` and each `survivor-n` restores followers, dead/turned states, infected including Alphas, shotgun ownership/pickup state and station occupants without duplication. | sim |
| E23-AC17 | **Real-input playthrough:** headless Playwright, mouse/keyboard only, from the cellar door through five finds to the closing shutter, 1 seed, 0 console errors, screenshots at all §6 photo spots | real-input e2e |
| E23-AC18 | **Vision — false-safety contrast:** for each pair camera, the L4 (`safe`) and L5 frames read as **the same place** (buildings recognizable) and L5 reads as "aftermath of a war" (checklist E "same place, fallen" + A); `l5-group-of-five` reads "the player is the only protector of a vulnerable group" (checklist D); the sunset reads red/orange and increasingly gloomy (checklist G). Each ≥ 7/10, no P0/P1 | vision |
| E23-AC19 | **Performance:** `l5-pair-plaza` (fires, smoke columns, W5 assets, 5 followers) holds the E18 budgets on both tiers; devastated variants stay within their asset budgets (no tier regression vs the L4 W0 frame of > 20 % in draw calls) | perf |

## 9. Notes for implementers
- The W5 twin is a **decay layer** of `D-FAIR` (E10), not a new district: swap assets by `decayVariants`, add dressing and debris, keep anchors.
- E08's density table (L5 = 6) roughly matches (5 survivors + lookout); update the E08-AC11 fixture when L5 is built.

## 10. Implementation notes and deviations (lane e23-l5, 2026-10-09)
Built on the L4 pattern: `src/data/l5.ts` (tuning, five survivors, wanderers, fires), `src/levels/L5/{layout,mission}.ts`, the controller `src/sim/missions/LevelFiveAftermath.ts`, the follower `src/sim/outbreak/Survivors.ts`, `src/debug/bot/LevelFiveBot.ts` and `tools/sim-runner/l5Bots.ts`; tests `tests/levels/L5.test.ts`, `tests/unit/levels/l5-static.test.ts`, `tests/e2e/levels/L5.spec.ts`, `tests/e2e/audio/l5.spec.ts`, `tests/perf/l5-budgets.spec.ts` and the `specs/scenes/qa-l5-*.json` scenes (generated by `tools/l5/gen-scenes.mjs`).
- **Hiding places (section 5.3):** the player's place list is kept, but the spec's "military truck" is the second L4 convoy truck on the plaza (a wreck there), so that four of five places are inside or behind buildings: Dale (plaza truck), Rosa (the pharmacy on Lakeshore Avenue's east end), Mr. Okafor (church), Mia (north-west apartment stairwell above Harbor Street), Sam (bus on Lakeshore Avenue). The order the cheapest tour visits them gives a long walk with the full group along Harbor Street to the Metro.
- **Survivors hide as entities that are not human targets** (`hidden`, frozen) until found: an infected cannot kill someone nobody has found. A sign of life is one positional cue (`l5.cue`: position, subtitle, direction ping on the HUD for 4 s) every 7 s while the courier is within 25 m (never beyond); the visual cues are static props (a flashlight in the bus, a radio and a sign by Mia's door), not blinking lights.
- **Escort group:** followers take slots behind the courier (alternating sides, 2-5 m) rather than a strict single file; through a narrow passage the grid route makes them single file. Crouching in cover is the `npc-cower` clip while an infected is within 8 m; "Wait!" (`l5.wait`) at 10 m. They never fight. A bitten survivor is the ordinary lane C/D lifecycle (grab 1.0 s, rescue by a hit on the grabber, 3.0 +/- 0.5 s to turn, same entity and look).
- **Loadout (AC12):** the L5 start loadout is always the L4 end loadout (axe, bat | machine gun, handgun, kick), whatever the campaign racks hold; the rocket launcher and the pipe bomb that `fixedUnlocks[4]` adds are not carried into L5 (no new weapon). Medkits (7) are scattered (not in the spec) so that a sensible run is survivable.
- **Devastation (AC06):** the `w5` shells (apartment blocks, storefront rows, town hall, church, Kessler's, the Metro entrance) are the facade damage and carry the bullet impacts. Pharmacies, supermarkets and the cafe have no `w5` shell: they get broken glass, fires and rubble only (a dedicated bullet-hole decal and a chalk-sign decal do not exist: missing assets; `decay.damaged-sign` stands in for the chalk "ALIVE INSIDE" sign). Burned and wrecked cars use only models that ship `wrecked`/`burned` shells (green sedan and SUV, white pickup stand in as their siblings). Corpses are finished pedestrians (>= 30; the national-guard skin in uniform); body bags (`decay.body-bag`) and the debris props (`debris.*`) are placeholders and not used.
- **Debris-blocked segments (AC05):** no street is fully blocked (a grid of single streets has no detour of 1.5x); three segments (Harbor Street, Plaza Way, Lakeshore Avenue) are narrowed by wreckage on their centre line with a gap of at least 1.4 m, each with a detour of about 1.0x.
- **Lights and look:** the power is out through the W5 layer (`disableLights`), but Scene Lab powers every placement, so dead lamps only show in the game. `L5` is dusk: sun `#ff7a38` at 0.85 (0.65x L4), polar 1.48 rad, a bright dusky-rose shadow tint (a sun on the horizon leaves roofs and ground in core shadow), red-to-violet sky; the gloom ramp (`state.l5.gloom`, 1 -> 0.5, monotone) is eased by `GameView` into `Lighting.setGloom`. Photo spots: the pair cameras of Harbor Street and Kessler Lane (L4 data, shared) were moved to where the rooflines do not hide the street (the L4 framing showed a roof); `l5-group-of-five` looks east along Harbor Street.
- **Sound (AC14):** L5 has no stems; the calm score starts at 60 s of mission time; stingers are skipped before it; the W5 beds are wind and fire; the ambient one-shots drop the helicopter. The offline 18 LU check compares a deterministic L5-quiet render against the L4-war surrogate `audio-mix` (the production graph with combat score, pistol fire, explosions and radio: a real L4 war phase cannot be rendered offline); the runtime check reads the live cue log.
- **Metro (AC15):** there is no animated shutter asset: `l5.shutter` (door sound, subtitle) marks the closing, the level completes 3 s later; the group is not walked down the stairs (they are inside the building model). The lookout (`npc.marcus.aftermath`) appears waving when all five are accounted for.
- **Bands (AC02/AC03):** recalibrated on the first green run, never padded: complete 100-240 s (observed ~124 s, the tour is short because the bot knows the places), newbie 130-300 s (observed ~210 s). Single-seed checks only (PO 10-09). The `evade-only` bot never attacks and loses people (rescues <= 2) but does not finish within 420 s.
- **Retired with the old L5 (convoy fallback):** the D-RES..D-EDGE mission, its barricade rail, `tests/sim/npc/integration.test.ts` convoy test, and the perf scene `perf-l5-bridge` (now `perf-l5-aftermath`: the W5 Fairhaven at the pair-plaza camera with the worst-cap crowd). `T-E12-07-L5` now ends in `progression`.
- **Handover:** `level.completed` carries `survivors` (keys); `CampaignUI` stores them in `campaign.survivors` for L6 (E24).
- **Pre-existing on main (verified at `ab90c079`, not caused by L5):** `tests/sim`: `T-E26-07` (barricades), the bicycle knock-off tip, the L1 corgi braking slide, `M1-06`, `T-E10-02` (L1 fire-station at W0), `T-E12-07-L1`, and the 4 ms sim p95 timings (`T-E07-11`, `T-E18-02`, `T-E08-11` L1) on the remote runners.

## 11. Implementation plan (2026-10-11)

All lanes ≤ 3 h, in order; reuse the existing five-survivor search, W5 composition, cues, follower infection and near-silence mix.

| Lane | Budget | Concrete change and reuse |
| --- | --- | --- |
| L5-S1 systems | 3 h | Reuse catalog shotgun/pellets/falloff and `src/sim/combat/Pickups.ts`; campaign no-ammo configuration, close-shot kill precedence, E07 Alpha damage; checkpoint ownership. |
| L5-D1 district | 2 h | Reuse `src/levels/L5/layout.ts`, `int.basement-cellar`, `wpn.shotgun`, W5 Fairhaven, `int.metro-station`; add shelf pickup and visible closable entrance doors (asset gap in inventory §7). |
| L5-E1 encounters + ending | 3 h | `src/data/l5.ts`, `LevelFiveAftermath.ts`, `Survivors.ts`: 1–2 Alphas inside sparse total, real station ingress, 20–30 occupant handover via `src/ui/CampaignUI.ts`. |
| L5-Q1 Scene Lab + browser e2e | 3 h | Extend `qa-l5-*.json`, `tests/levels/L5.test.ts` and headless `tests/e2e/levels/L5.spec.ts`: shotgun roles, all pair cameras, visible entry/closing doors, existing audio and tier budgets. |

Epic report rationale: AC01/04/12/15/16 supersede no-new-weapon and empty-station assumptions per the PO. §10's loadout/no-pickup and sound-only shutter deviations are superseded; the new ending requires visible ingress and closure. Existing timings/cues/layout/escort implementation stay where compatible. `T-E23-01`…`T-E23-19` retain their tags and require updated assertions.


## PO 2026-10-15 precedence (spec audit)

Source: `epics-pipeline/po-bugs-1015.md` in the main workspace; these newer decisions override the older defaults above.

- #21b, verbatim: "I still don't get this suvivor". The binding intake requires a visible blinking flashlight at Sam's bus plus an objective distance or minimap ring. This supersedes AC08's blanket prohibition on survivor objective markers only for that discovery guidance. No unrelated survivor reveal is required.
- #26, verbatim: "L5: show health bar for the 5 survivors, so the player knows how they are. Also let them pick up med packs on their own if they need it (but make sure the one who needs it most takes it, not the the one at 99%)". AC09 includes world bars, HUD portrait health and a reserved medpack sought by the lowest health fraction below 70% within 8 m when safe; the player may still collect it.
- #28, verbatim: "L5: show my survivors (as long as they live) on the radar as green moving dots". AC09 includes moving green follower dots, removed on death and clamped to the radar edge outside its radius.
- #29, verbatim: "L5 is a good difficulity level. Let's not change Zombies and alphas". Keep counts, placement, speed, damage and HP unchanged; retain the explicitly approved #25 exception (E07 precedence section). Pin complete/newbie outcomes and deaths.
- #37's verbatim shotgun decision is quoted in E07's precedence section; AC12 includes permanent one-shot kills for every regular archetype within about 8 m and Alpha stagger/knockback per close hit. The 60 HP fixture alone is insufficient evidence.
