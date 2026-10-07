# E23 · Level 5: Aftermath

> **Rewritten 2026-10-07 per product owner** (`po-levels-2-6-2026-10-07.md`, which wins on any disagreement). This replaces the previous L5 "Hold the Line" (convoy HP, four fallback positions, gas-station mega hazard, the bridge blown early). That content is superseded; its systems are reused (escort follower, barricade props, decay layers, mega-blast sequencer for E22).

## 1. Goal

A ~5-minute, deliberately **quiet** level in the **same streets as L4**, hours later, at **sunset**. The player climbs out of the Kessler's Hardware basement into a Fairhaven that is now genuinely devastated: the same recognizable buildings, burned, shot up, partly collapsed, with no soldiers, no crowds, no helicopters, no battle. A few infected wander the ruins. The player hears or discovers signs of life and **finds five survivors** hidden around the city, one by one; each joins and follows. The player, the only heavily armed protector, keeps the growing group (1 → 2 → 3 → 4 → 5) alive and leads whoever remains to the **Fairhaven Metro station**, a defensible shelter that has attracted other survivors.

Emotional outcome: **the war is over, and you walk through its silent aftermath.** L4 was deafening, L5 is almost silent; the impact comes from recognizing places the player saw intact or active an hour of play ago. Relationship: the player becomes **the primary protector of survivors**. No new weapon (the machine gun stays the primary weapon).

## 2. Depends on / Enables

E22 (`D-FAIR` and its pair cameras, machine gun, basement), E08 (escort follower without mission fail, survivor states), E10 (decay layer system: the `D-FAIR` W5 twin), E12, E14 (survivor counter), E16 (near-silence mix, positional cues), E25 (`L5` sunset preset, fire light), E27 (persistent fires, smoke columns, wreck variants), E28 (optional: still air, ash and embers) / **E24** (starts inside the metro station), M3.

## 3. Scope

**In:** the basement exit; the devastated `D-FAIR` W5 twin (same layout, damaged assets); sparse infected; the five hidden survivors with discovery cues; the escort group with no fail state; the metro station entrance as destination; the `L5` sunset preset with a gloom ramp; the near-silent sound arc; L4/L5 pair photo spots; bots and tests.

**Out:** new weapons (weapon escalation pauses, PO); hordes, waves or director horde spawns (sparse by design); ally fighters (none survive); survivors with weapons (orchestrator default: all five are unarmed — PO may change); fail on survivor death (PO: the level continues).

## 4. Level structure and story beats (~5 min)

| # | Beat | Location (`D-FAIR`, W5 twin) | What happens | Target time |
| --- | --- | --- | --- | --- |
| 1 | Emerging | Kessler's Hardware cellar → Kessler Lane | Caption *"Hours later."* (orchestrator default). The player unbars the door and steps out at `pair-kessler-lane`. Silence: wind, crackling fire, a distant collapse. No objective for ~10 s, then: **Look for anyone still alive**. | 0:00–0:20 |
| 2 | Recognition | Harbor Street → Reception Plaza | The streets from L4, now empty: burned-out cars, the wrecked tank and trucks, blown sandbag lines, the fuel-truck crater, corpses (many in uniform), scattered weapons and belongings, smoke, fires still burning. A few infected wander. | 0:20–1:00 |
| 3 | Five survivors | five hiding places across the district (§5.3) | Each survivor gives a **sign of life** (voice, knocking, a blinking flashlight, chalk "ALIVE INSIDE", a radio). The player finds them in any order; stand-to-interact (1.0 s) → *"You're… real. Take me with you."* → the survivor follows. HUD: **Survivors found n/5**. Every encounter is more tense with more people to protect. | 1:00–3:45 |
| 4 | To the metro | plaza → Lakeshore Avenue → **Fairhaven Metro** entrance | When all five are accounted for (found, dead or turned), objective: **Lead the survivors to the metro station**. A lookout behind the half-open shutter waves them in with a flashlight. | 3:45–4:45 |
| 5 | Shelter | metro entrance stairs | The player and the living followers go down; the shutter rolls closed behind them. `level.completed`; L6 starts inside the station. | 4:45–5:00 |

**Checkpoints:** `outside` (after leaving the basement), after each survivor found (`survivor-1` … `survivor-5`). **No fail timer; no fail on survivor death.**

## 5. Systems

E20 §5.1 outbreak rules apply (sight-only, no omniscience, bitten survivors turn with identity continuity). Machine-gun loud events (30 m, E21 §5.3) pull nearby wanderers to the shot position: every burst has a cost.

### 5.1 `D-FAIR` W5 twin (same city, devastated)
- **Same layout:** identical road graph, nav topology (except debris blocking ≤ 3 street segments, each with a detour), and building transforms as L4. Every L4 hero building and every street-facing building has a devastated variant at the same transform; footprints match.
- **Damage (minimums):** ≥ 10 burned-out cars, ≥ 3 wrecked military vehicles (incl. the tank and an HMG vehicle), ≥ 6 fires still burning, broken windows on ≥ 70 % of street frontages, collapsed or heavily damaged facades on ≥ 4 buildings, bullet-damage decals on every plaza facade, ≥ 4 smoke columns, ≥ 30 corpses (≥ 10 in uniform), scattered weapons and belongings, destroyed barricades (blown sandbag lines, abandoned nests, the fuel-truck crater).
- **Nothing active:** no living soldiers or civilians (except the five survivors and the metro lookout), no helicopters, no vehicles moving, no gunfire except the player's.

### 5.2 Infected (sparse)
12–20 wandering infected at start (orchestrator default), spread in ones and twos (no group > 3), plus any survivor that turns. **No director spawns or emergence** in L5. Cap 30 (both tiers). Survivors and the player are equally valid targets (closest visible human).

### 5.3 Survivors and signs of life
- Five named survivors with existing character models in soot-and-bandage tint variants (orchestrator default casting — PO may change): **Dale** (mechanic, `npc.survivor-group`), **Rosa** (paramedic, `npc.paramedic`), **Mr. Okafor** (elderly, `npc.civilian-elderly`), **Mia** (shop clerk, `npc.civilian-woman-a`), **Sam** (hunter without his rifle, `npc.survivor-group`). All adults.
- Hiding places ≥ 25 m apart, at least 4 inside or behind buildings: the pharmacy back room, a wrecked bus on Lakeshore Avenue, the church vestry, an apartment stairwell above Harbor Street, the cab of a wrecked military truck.
- **Sign of life:** each place emits a cue the player can perceive within 25 m (positional voice/knocking with a subtitle and its direction, or a visual cue: blinking flashlight, chalk sign). No objective markers on survivors (orchestrator default); the HUD shows a direction ping for a heard cue for 4 s.

### 5.4 Escort group (the player as protector)
- Found survivors follow at 2–5 m (E08 escort follow, `failOnDeath: false`), single-file through narrow passages, run at 3.8 m/s (slower than the player's run and every infected), call *"Wait!"* when > 10 m behind; when an infected is within 8 m they crouch in cover.
- **Vulnerable:** unarmed; an infected that reaches a survivor grabs and bites (1.0 s rescue window for the player, E19 §5.1); a bitten survivor turns in 3.0 ± 0.5 s next to the group.
- Lost survivors are not replaced; the level continues and stays completable with zero survivors.
- Level end: the shutter closes when the player is inside the station trigger and every living follower is within 15 m or 10 s have passed; followers inside count as **rescued** (carried into L6).

### 5.5 Lighting and sound
- Preset `L5` (sunset): sun near the horizon (polar 1.45–1.55 rad), deep red/orange sun (hue 0–25°), red-to-violet sky, intensity ≤ 0.7× `L4`, long shadows; a **gloom ramp** lowers the sun intensity monotonically over the level (≥ 30 % darker at the metro than at the basement exit). Fires and the light field carry more of the image as the sun fades.
- **Near-silence:** no music for the first 60 s, then a sparse low drone; ambience = wind, fire crackle, distant single collapses, an infected's breathing when near; no battle sounds. The mix makes every machine-gun burst feel loud.

## 6. Photo spots
The four pair cameras from E22 in the W5 state: `pair-plaza`, `pair-harbor-street`, `pair-metro-entrance`, `pair-kessler-lane`; plus `l5-basement-exit`, `l5-sign-of-life`, `l5-group-of-five` (player leading 5 followers in sunset light), `l5-metro-shelter`.

## 7. Bruno references
- [`Tornado.js`](../folio-2025/sources/Game/Tornado.js): smoke columns over the ruins
- [`World/PoleLights.js`](../folio-2025/sources/Game/World/PoleLights.js): broken/dead lamps (power off), the lookout flashlight
- [`InteractivePoints.js`](../folio-2025/sources/Game/InteractivePoints.js): survivor interactions
- [`Cycles/DayCycles.js`](../folio-2025/sources/Game/Cycles/DayCycles.js): the sunset gloom ramp

## 8. Acceptance criteria

Bots: `complete`, `newbie`, `evade-only` (escorts but never attacks), `idle`. Time bands are **provisional**; recalibrate on the first green 20-seed run (staging §6, never padded).

| ID | Criterion | Verification |
| --- | --- | --- |
| E23-AC01 | The L5 mission graph (leave basement → find 5 → reach the metro) is structurally completable (E12-AC07) for every find order, with no fail timer and no fail on survivor death | sim |
| E23-AC02 | The `complete` bot finishes L5 on **20/20 seeds** from `L5-default` (machine gun) without cheats; median sim time **2:00–4:00**; median survivors rescued ≥ 4 | sim |
| E23-AC03 | The `newbie` bot finishes on ≥ 18/20 seeds, median **2:30–5:00**, median deaths ≤ 1, median survivors rescued ≥ 3 | sim |
| E23-AC04 | **Opening is empty:** at level start and for the first 60 s there are zero allied fighters, zero living civilians except the 5 survivors and the lookout, zero helicopters or moving vehicles, zero non-player gunfire events; 12–20 infected exist, no group > 3 | sim |
| E23-AC05 | **Same city:** the L5 composition uses the `D-FAIR` layout with an identical road graph; for every L4 hero building the L5 variant has the same transform and its top-down footprint mask has IoU ≥ 0.9 with L4; nav differs only by ≤ 3 debris-blocked segments, each with a detour ≤ 1.5× | unit (layout) |
| E23-AC06 | **Devastation:** the static W5 dressing manifest meets the §5.1 minimums (burned cars ≥ 10, wrecked military vehicles ≥ 3, fires ≥ 6, broken windows ≥ 70 % of frontages, damaged/collapsed facades ≥ 4, smoke columns ≥ 4, corpses ≥ 30 with ≥ 10 in uniform, destroyed barricades) | static |
| E23-AC07 | **Sparse, never omniscient:** no director spawn or emergence event fires in L5; concurrent infected ≤ 30; the E20-AC11 omniscience audit passes; machine-gun bursts pull non-chasing infected within 30 m to the shot position (E21-AC06 rule) | sim |
| E23-AC08 | **Signs of life:** each survivor's cue is perceivable (audio event with position + subtitle, or visual cue in frustum) within 25 m and not beyond 30 m; no objective marker points at a survivor; the hiding places are ≥ 25 m apart and ≥ 4 are inside/behind buildings | sim + static |
| E23-AC09 | **Group grows and follows:** interaction (1.0 s) makes a survivor follow; the HUD counter steps 0 → 5 as found; followers stay within 8 m of the player ≥ 80 % of non-combat time, never teleport (no jump > 1 m per tick), and are slower than the player's run (3.8 m/s) | sim |
| E23-AC10 | **Protection matters:** an infected reaching an unprotected survivor bites within 1.5 s; a hit during the 1.0 s grab saves them; a bitten survivor turns in 2.5–3.5 s with identity continuity; the `evade-only` bot rescues a median ≤ 2 survivors while `complete` rescues ≥ 4 (20 seeds) | sim |
| E23-AC11 | **Losses don't stop the level:** force-killing 1, 3 or all 5 survivors at random points still lets the `complete` bot finish on 20/20 seeds; the result screen and the L6 handover report the rescued count | sim |
| E23-AC12 | **No new weapon:** the L5 loadout equals the L4 end loadout at start and at end (no weapon pickups exist in L5) | sim |
| E23-AC13 | **Sunset and gloom:** `timeOfDay.L5.polar` in 1.45–1.55 rad, sun hue 0–25°, intensity ≤ 0.7× `L4`; the sun intensity decreases monotonically over the level and is ≥ 30 % lower at the metro trigger than at the basement exit | unit + sim |
| E23-AC14 | **Near-silence:** no music cue in the first 60 s; the mix-bus loudness over L5's first 60 s (offline render) is ≥ 18 LU below the loudness of L4's war phase (`l4.firstTurn` → `l4.lineBreaks`); no battle-layer cues play in L5 | e2e (offline audio) |
| E23-AC15 | **Metro and handover:** the objective switches to the metro when all five are accounted for; the shutter closes only per the §5.4 rule; `level.completed` carries the rescued survivor ids into L6; no reward screen | sim + e2e |
| E23-AC16 | **Checkpoints:** dying right after `outside` and each `survivor-n` restores the snapshot (followers, dead/turned survivors stay so, infected) within tolerance | sim |
| E23-AC17 | **Real-input playthrough:** headless Playwright, mouse/keyboard only, from the cellar door through five finds to the closing shutter, 1 seed, 0 console errors, screenshots at all §6 photo spots | real-input e2e |
| E23-AC18 | **Vision — false-safety contrast:** for each pair camera, the L4 (`safe`) and L5 frames read as **the same place** (buildings recognizable) and L5 reads as "aftermath of a war" (checklist E "same place, fallen" + A); `l5-group-of-five` reads "the player is the only protector of a vulnerable group" (checklist D); the sunset reads red/orange and increasingly gloomy (checklist G). Each ≥ 7/10, no P0/P1 | vision |
| E23-AC19 | **Performance:** `l5-pair-plaza` (fires, smoke columns, W5 assets, 5 followers) holds the E18 budgets on both tiers; devastated variants stay within their asset budgets (no tier regression vs the L4 W0 frame of > 20 % in draw calls) | perf |

## 9. Notes for implementers
- The W5 twin is a **decay layer** of `D-FAIR` (E10), not a new district: swap assets by `decayVariants`, add dressing and debris, keep anchors.
- E08's density table (L5 = 6) roughly matches (5 survivors + lookout); update the E08-AC11 fixture when L5 is built.
