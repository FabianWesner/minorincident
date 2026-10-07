# E24 · Level 6: The Subway

> **Rewritten 2026-10-07 per product owner** (`po-levels-2-6-2026-10-07.md`, which wins on any disagreement). This replaces the previous L6 "Get Out" (W5 revisit of L1–L5 places, fire-engine run, helipad stand, helicopter ending at dawn). That content is superseded; the fire engine, helipad and helicopter assets stay for later levels. L6 is now the **end of the currently designed sequence** and the starting point for a future Level 7.

## 1. Goal

A ~5-minute level **underground**. It begins inside the Fairhaven Metro station shelter with the survivors rescued in L5 (however many made it) and **20–30 other survivors**. For a moment it is comparatively pleasant: people sit, talk, treat injuries, rest and share supplies, and the player can walk around and absorb it. There is **no new weapon**: escalation now comes from **responsibility, not firepower**. Then infected get in through the **maintenance tunnels**: one or two at first, manageable; then more, and the shelter fails. The survivors abandon the station and move deeper into the subway; the player covers the retreat through confined tunnels, holds doors and narrow passages, shoots infected while the group moves and protects stragglers. The group reaches another station exit and **emerges above ground. It is night.**

Emotional outcome: **strong firepower, a large vulnerable group: protecting people is the hard part.** Escalation position: **the survivors gather underground, and even the subway is breached.** Relationship: the player is the protector of a whole community. Environment: underground shelter → night.

## 2. Depends on / Enables

E23 (rescued survivor ids, the metro entrance), E08 (crowd routines, group follower), E12, E14, E16 (underground acoustics, breach telegraphs), **E25** (power groups: fluorescent main lights failing to emergency lights, the weapon flashlight, night readability), **E26** (gates and braceable barricade slots at chokepoints), E27 (sparks, smoke in tunnels), E18 / future **Level 7**, M3 exit (full campaign).

## 3. Scope

**In:** district `D-SUBWAY` (shelter station, maintenance tunnels, track tunnel, the exit station and a small night-street exit patch); the calm shelter beat; the two-stage breach; the group retreat along the tunnel with stragglers; chokepoints (closable gates, braceable slots, narrow passages); the power failure and emergency lighting; the night exit and the end of the current campaign; the full-campaign test; bots and tests.

**Out:** new weapons or pickups (PO: weapon escalation pauses); an above-ground street attack (PO prefers underground access routes); trains (orchestrator default: no moving trains, the system is dead); children in the shelter (orchestrator default per R1, because the shelter falls); the old helicopter ending.

## 4. Level structure and story beats (~5 min)

| # | Beat | Location (`D-SUBWAY`) | What happens | Target time |
| --- | --- | --- | --- | --- |
| 1 | The shelter | Lakeshore station: concourse (ticket hall, kiosks, turnstiles) and platform | The L5 survivors are here (by id) plus 24 others (20–30; 15 on low). People sit on benches and mats, talk in groups, a medic (Rosa if she survived, otherwise a shelter medic) treats injuries, a man hands out water and cans, someone sleeps, a guard (**Marcus**, the shelter organizer) stands at the shutter. Warm camp lights under cool fluorescent strips; quiet voices; a radio with static. No combat. | 0:00–0:35 |
| 2 | First breach | maintenance door at the platform end | A bang behind the service door (`l6.breach1`, 30–40 s, seeded): **1–2 infected** stumble in from the maintenance corridor. Screams, but it is manageable. Objective: **Stop the infected**. | 0:35–1:05 |
| 3 | The shelter fails | two maintenance access points + the stairs to the street | `l6.breach2` (20–30 s after the first): more infected pour in from ≥ 2 service accesses; the main lights fail (`power.off metro-main`) → red emergency lights, the weapon flashlight turns on. Survivors are grabbed and turn. Marcus: *"Into the tunnel! Everybody, move!"* (`l6.abandon`). Objective: **Cover the retreat through the tunnel**. | 1:05–1:45 |
| 4 | Retreat | track tunnel north (≈ 220 m), cross-passages, a pump room, a signal room | The group moves along the track bed behind Marcus with flashlights; the injured lag behind. Infected follow from the station and emerge from side maintenance passages. The player holds the rear, closes gates behind the group, braces a door with crates, shoots infected in narrow passages and brings stragglers back. | 1:45–4:30 |
| 5 | Exit | Northgate station platform → stairs → night street | The group climbs the dead escalator and pushes through the exit gate. Above ground: **night**, a quiet, damaged street, fires on the skyline. The last survivors come up; the gate closes. End caption *"Night. Still alive."* (orchestrator default — PO may change), the result with the campaign summary, credits, then the main menu. | 4:30–5:00 |

**Checkpoints:** `shelter` (level start), `abandon`, `mid-tunnel` (the second chokepoint), `exit-platform`. **No fail timer; no fail on survivor deaths.**

## 5. Systems

E20 §5.1 outbreak rules apply (sight-only, no omniscience, bitten survivors turn with identity continuity, emergent snowball). Machine-gun loud events (30 m, E21 §5.3) carry through the tunnels.

### 5.1 District `D-SUBWAY` (confined)
- **Lakeshore station** (shelter): concourse ≈ 30 × 20 m, platform ≈ 60 × 10 m, one street stair (sealed by the shutter from L5), **≥ 2 maintenance access doors** into a service-corridor network (the breach source).
- **Track tunnel** ≈ 200–260 m to **Northgate station** (platform, dead escalator, exit gate), with ≥ 3 side maintenance passages (emergence points), ≥ 2 cross-passages, a pump room and a signal room.
- **Chokepoints:** ≥ 3 along the route, each ≤ 2.5 m wide, each with a closable service gate or a braceable E26 barricade slot with enough props nearby.
- **Confined:** main tunnel width ≤ 8 m; no open area larger than 30 × 30 m except the two stations.
- **Night exit patch:** a ≈ 30 × 30 m street at the Northgate exit, W4 dressing, `L6` night preset.

### 5.2 Survivors (the group)
- Shelter survivors 20–30 (default 24; 15 on low) plus the L5 rescued (0–5). Routines: sit, talk in facing groups, treat injuries (medic + patient pairs), rest/sleep on mats, share supplies (hand-over gestures), the guard; nobody idles facing nowhere > 3 s (E19 §5.1 rule).
- **Retreat movement:** after `l6.abandon` the group follows **Marcus** along the tunnel path (crowd follower, average 2.2 m/s); ≈ 20 % are injured (1.4 m/s). A survivor > 15 m behind the group's tail becomes a **straggler** (`l6.straggler`); a straggler within 3 m of the player follows the player until rejoined.
- The group waits at a chokepoint until the player is within 12 m when infected are within 20 m of the tail (orchestrator default: they do not run blindly ahead into the dark).
- Survivors are unarmed except Marcus (handgun stats, 50 % hit chance) (orchestrator default). Bitten survivors turn next to the group.
- Lost survivors are not replaced; the level stays completable with zero survivors.

### 5.3 Breach and pressure
- `l6.breach1`: 1–2 infected through one maintenance door, no other infected in the level.
- `l6.breach2` (+20–30 s): 6–10 infected from ≥ 2 accesses, then a stream (2–4 per 10 s) from the station behind the group and from side passages ahead of and beside the group (E19 emergence rule: doors outside the frustum).
- `l6.abandon` fires at breach2 + 15 s or when ≥ 3 survivors have been bitten, whichever first.
- Caps: concurrent infected ≤ 60 (high) / 30 (low).

### 5.4 Chokepoints and doors
- **Service gates:** the player closes a gate with stand-to-interact 1.0 s; a closed gate blocks movement and sight; infected break it in 8–12 s (barricade HP, E26-AC10 rules); bracing props into the gate slot adds HP (E26-AC09).
- Gates cannot be closed while a survivor is within 2 m of the gate line (no trapping people on the wrong side).

### 5.5 Lighting and sound
- Preset `L6-subway` (no sun): cool fluorescent strips (power group `metro-main`, occasional flicker), warm camp lights in the shelter; after `l6.breach2` main power fails within 1 frame → red emergency lights (`metro-emergency`) every ≤ 15 m and the **weapon flashlight** (hero light following the aim). E25 night readability rule: the player readable at ≥ 3:1, infected eyes the brightest pixels of each infected.
- Exit: preset `L6` (night: cool moonlight, fires on the skyline).
- Sound: shelter murmur and radio static → bangs behind the service door (breach telegraph ≥ 1.5 s before each breach) → tunnel reverb, echoing screams, the group's footsteps → the open night air at the exit.

## 6. Photo spots
`l6-shelter-calm` (people sitting, talking, treating injuries, sharing supplies), `l6-first-breach`, `l6-shelter-fails` (emergency red light), `l6-tunnel-retreat` (group + player covering the rear with the flashlight), `l6-chokepoint`, `l6-straggler`, `l6-exit-night`.

## 7. Bruno references
- [`World/PoleLights.js`](../folio-2025/sources/Game/World/PoleLights.js): strip lights, power switching, emergency lamps
- [`Objects.js`](../folio-2025/sources/Game/Objects.js): crates braced into gates
- [`Fog.js`](../folio-2025/sources/Game/Fog.js): tunnel haze lit by flashlights
- [`View.js`](../folio-2025/sources/Game/View.js): tighter camera in tunnels, exit reveal

## 8. Acceptance criteria

Bots: `complete` (covers the rear, closes gates, collects stragglers), `newbie`, `evade-only` (never attacks), `idle` (stays in the shelter). Time bands are **provisional**; recalibrate on the first green 20-seed run (staging §6, never padded; the group's walking pace sets the floor).

| ID | Criterion | Verification |
| --- | --- | --- |
| E24-AC01 | The L6 mission graph (shelter → stop the first infected → cover the retreat → exit) is structurally completable (E12-AC07), with no fail timer and no fail on survivor death | sim |
| E24-AC02 | The `complete` bot finishes L6 on **20/20 seeds** from `L6-default` (machine gun, 5 rescued survivors) without cheats; median sim time **3:00–4:30**; median ≥ 60 % of all survivors exit | sim |
| E24-AC03 | The `newbie` bot finishes on ≥ 18/20 seeds, median **3:15–5:00**, median deaths ≤ 2, median ≥ 40 % of survivors exit | sim |
| E24-AC04 | **Shelter:** at start 20–30 shelter survivors (15 on low) plus exactly the L5 rescued ids are present; all non-guard survivors are in routines (sit/talk/treat/rest/share, each present), none idle facing nowhere > 3 s; zero infected and zero `combat.*` events before `l6.breach1` | sim |
| E24-AC05 | **No new weapon:** the loadout at L6 start and end equals the L5 end loadout; no weapon pickup exists in `D-SUBWAY` | sim |
| E24-AC06 | **Breach comes from below:** every infected in L6 first appears within 3 m of a maintenance/service door or side passage outside the frustum, or arrives through the tunnel; none enters through the street stair; breach1 releases 1–2 infected, breach2 (+20–30 s) 6–10 from ≥ 2 accesses; each breach is telegraphed by door-bang audio ≥ 1.5 s before | sim |
| E24-AC07 | **Shelter fails:** `l6.abandon` fires by its first-of rule (breach2 + 15 s / ≥ 3 bitten), also with the `idle` bot; `power.off metro-main` fires within 1 frame of breach2 and emergency lights + the weapon flashlight turn on | sim |
| E24-AC08 | **Full campaign:** the `complete` bot plays L1 → L6 continuously on **10 seeds** in the sim runner with no reward screens, loadouts carrying over (bat → axe → handgun → machine gun) and the L5 rescued ids arriving in L6; the `newbie` total sim time is within the sum of the six per-level newbie bands | sim |
| E24-AC09 | **Covering the retreat matters:** the `evade-only` bot gets a median ≤ 30 % of survivors out, the `complete` bot ≥ 60 % (20 seeds); the group pauses at a chokepoint when infected are within 20 m of its tail and the player is > 12 m away | sim |
| E24-AC10 | **Stragglers:** injured survivors move at 1.4 m/s and become stragglers (`l6.straggler`) when > 15 m behind the tail; a straggler within 3 m of the player follows the player until rejoining; the `complete` bot rejoins ≥ 70 % of stragglers (median) | sim |
| E24-AC11 | **Chokepoints and doors:** ≥ 3 chokepoints ≤ 2.5 m wide along the route; a closed gate blocks movement and sight and holds 8–12 s against 5 infected (+ the braced HP per E26-AC09/AC10); a gate refuses to close with a survivor within 2 m of its line | sim |
| E24-AC12 | **Confined layout:** main tunnel width ≤ 8 m; no open area > 30 × 30 m outside the two stations; tunnel length 200–260 m; ≥ 3 side passages, ≥ 2 cross-passages; sight blockers every ≤ 25 m (layout test) | unit (layout) |
| E24-AC13 | **Caps and survivor infection:** concurrent infected ≤ 60 (high) / 30 (low); bitten survivors turn in 2.5–3.5 s with identity continuity; the E20-AC11 omniscience audit passes | sim |
| E24-AC14 | **Night exit and campaign end:** at the Northgate exit the time-of-day preset switches to `L6` night (sun/moon elevation below the L5 value, intensity ≤ 0.4× `L4`); the closing gate ends the level; the caption text matches exactly, the result screen shows survivors out / in and the campaign summary totals equal the sum of the per-level results; credits roll, then the main menu | sim + e2e |
| E24-AC15 | **Underground readability:** at `l6-tunnel-retreat` and `l6-shelter-fails` the player mask contrast against its 2 m ring is ≥ 3:1 and infected eyes are the brightest pixels of each infected (E25-AC13 metric); the flashlight is a promoted hero light with a shadow | visual |
| E24-AC16 | **Checkpoints:** dying right after `shelter`, `abandon`, `mid-tunnel`, `exit-platform` restores the snapshot (survivor states and positions, gates, power state, outbreak layer) within tolerance | sim |
| E24-AC17 | **Real-input playthrough:** headless Playwright, mouse/keyboard only (gate closing via `E`), from the shelter to the night exit and the result screen, 1 seed, 0 console errors, screenshots at all §6 photo spots | real-input e2e |
| E24-AC18 | **Vision review** (checklists A, D, G): `l6-shelter-calm` reads "comparatively pleasant: people sitting, talking, treating injuries, sharing supplies"; `l6-shelter-fails` reads "the shelter is failing"; `l6-tunnel-retreat` reads "strong firepower, large vulnerable group, confined space" and feels very different from the open streets of L1–L5; `l6-exit-night` reads "above ground, night". Each ≥ 7/10, no P0/P1 | vision |
| E24-AC19 | **Performance:** `perf-l6-tunnel` (≥ 25 survivors moving + ≥ 40 infected + emergency lights + flashlight shadow) holds the E18 budgets on both tiers; no frame > 50 ms at `l6.breach2` (power failure) or `l6.abandon` | perf |

## 9. Notes for implementers
- The group follower is a crowd variant of the E08 escort follower (one leader on a path, followers keep formation slots); no per-survivor pathfinding through the whole tunnel.
- E08's density table (L6 = 2–3 stragglers) is superseded for L6 (20–30 shelter survivors); update the E08-AC11 fixture when L6 is built.
- The old full-campaign test kept its ID (E24-AC08) so `91-test-plan.md` stays valid.
