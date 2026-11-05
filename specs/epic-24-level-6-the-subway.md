# E24 · Level 6: The Subway

> **Updated 2026-10-11 per product owner** (`po-levels-4-9-2026-10-11.md`, which wins on any disagreement). Changed criteria are marked **CHANGED 2026-10-11**; underground beats remain as specified. This replaces the previous L6 "Get Out" (W5 revisit of L1–L5 places, fire-engine run, helipad stand, helicopter ending at dawn). That content is superseded; the fire engine, helipad and helicopter assets stay for later levels. L6 now hands over to **E29 / L7: The Ruined City** at the night exit.

## 1. Goal

A ~5-minute level **underground**. It begins inside the Fairhaven Metro station shelter with the survivors rescued in L5 (however many made it) and **20–30 other survivors**. For a moment it is comparatively pleasant: people sit, talk, treat injuries, rest and share supplies, and the player can walk around and absorb it. There is **no new weapon**: escalation now comes from **responsibility, not firepower**. Then infected get in through the **maintenance tunnels**: one or two at first, manageable; then more, and the shelter fails. The survivors abandon the station and move deeper into the subway; the player covers the retreat through confined tunnels, holds doors and narrow passages, shoots infected while the group moves and protects stragglers. The group reaches another station exit and **emerges above ground. It is night.**

Emotional outcome: **strong firepower, a large vulnerable group: protecting people is the hard part.** Escalation position: **the survivors gather underground, and even the subway is breached.** Relationship: the player is the protector of a whole community. Environment: underground shelter → night.

> PO, verbatim: "There is no new weapon. The player keeps the existing arsenal. The level is about protecting people, not another weapon upgrade."
>
> "Eventually the group reaches another exit and climbs back above ground."
>
> "It is now night."

## 2. Depends on / Enables

E23 (rescued survivor ids, the metro entrance), E08 (crowd routines, group follower), E12, E14, E16 (underground acoustics, breach telegraphs), **E25** (power groups: fluorescent main lights failing to emergency lights, the weapon flashlight, night readability), **E26** (gates and braceable barricade slots at chokepoints), E27 (sparks, smoke in tunnels), E18 / **E29 / Level 7**, M3 campaign continuation.

## 3. Scope

**In:** district `D-SUBWAY` (shelter station, maintenance tunnels, track tunnel, the exit station and a small night-street exit patch); the calm shelter beat; the two-stage breach; the group retreat along the tunnel with stragglers; chokepoints (closable gates, braceable slots, narrow passages); the power failure and emergency lighting; the night exit and direct handover to L7; the full-campaign test; bots and tests.

**Out:** new weapons (the PO 10-15 headlamp is an equipment pickup) (PO: weapon escalation pauses); an above-ground street attack (PO prefers underground access routes); trains (orchestrator default: no moving trains, the system is dead); children in the shelter (orchestrator default per R1, because the shelter falls); the old helicopter ending.

## 4. Level structure and story beats (~5 min)

| # | Beat | Location (`D-SUBWAY`) | What happens | Target time |
| --- | --- | --- | --- | --- |
| 1 | The shelter | Lakeshore station: concourse (ticket hall, kiosks, turnstiles) and platform | The L5 survivors are here (by id) plus 24 others (20–30 on both tiers; orchestrator default count). People sit on benches and mats, talk in groups, a medic (Rosa if she survived, otherwise a shelter medic) treats injuries, a man hands out water and cans, someone sleeps, a guard (**Marcus**, the shelter organizer) stands at the shutter. Warm camp lights under cool fluorescent strips; quiet voices; a radio with static. No combat. | 0:00–0:35 |
| 2 | First breach | maintenance door at the platform end | A bang behind the service door (`l6.breach1`, 30–40 s, seeded): **1–2 infected** stumble in from the maintenance corridor. Screams, but it is manageable. Objective: **Stop the infected**. | 0:35–1:05 |
| 3 | The shelter fails | two maintenance access points + the stairs to the street | `l6.breach2` (20–30 s after the first): more infected pour in from ≥ 2 service accesses; the main lights fail (`power.off metro-main`) → red emergency lights, the collected headlamp stays on. Survivors are grabbed and turn. Marcus: *"Into the tunnel! Everybody, move!"* (`l6.abandon`). Objective: **Cover the retreat through the tunnel**. | 1:05–1:45 |
| 4 | Retreat | track tunnel north (≈ 220 m), cross-passages, a pump room, a signal room | The group moves along the track bed behind Marcus with flashlights; the injured lag behind. Infected follow from the station and emerge from side maintenance passages. The player holds the rear, closes gates behind the group, braces a door with crates, shoots infected in narrow passages and brings stragglers back. | 1:45–4:30 |
| 5 | Exit | Northgate station platform → stairs → night street | The group climbs the dead escalator and pushes through the exit gate. Above ground: **night**, a quiet, damaged street, fires on the skyline. The last survivors come up; the gate closes. End caption *"Night. Still alive."* (existing orchestrator default), then L7 starts at this same exit with the surviving group and carried weapons; no campaign-end credits/menu here. | 4:30–5:00 |

**Checkpoints:** `shelter` (level start), `abandon`, `mid-tunnel` (the second chokepoint), `exit-platform`. **No fail timer; no fail on survivor deaths.**

## 5. Systems

E20 §5.1 outbreak rules apply (sight-only, no omniscience, bitten survivors turn with identity continuity, emergent snowball). Machine-gun loud events (30 m, E21 §5.3) carry through the tunnels.

### 5.1 District `D-SUBWAY` (confined)
- **Lakeshore station** (shelter): concourse ≈ 30 × 20 m, platform ≈ 60 × 10 m, one street stair (sealed by the shutter from L5), **≥ 2 maintenance access doors** into a service-corridor network (the breach source).
- **Track tunnel** ≈ 200–260 m to **Northgate station** (platform, dead escalator, exit gate), with ≥ 3 side maintenance passages (emergence points), ≥ 2 cross-passages, a pump room and a signal room.
- **Chokepoints:** ≥ 3 along the route, each ≤ 2.5 m wide, each with a closable service gate or a braceable E26 barricade slot with enough props nearby.
- **Confined:** main tunnel width ≤ 8 m; no open area larger than 30 × 30 m except the two stations.
- **Night exit patch:** a ≈ 30 × 30 m street at the Northgate exit, a W6 continuity preview of `D-FAIR` at Northgate, `L6` night preset, shared exit anchor with E29 (orchestrator default extent; the main W6 district build belongs to E29).

### 5.2 Survivors (the group)
- Shelter survivors 20–30 (default 24 on both tiers) plus the L5 rescued (0–5). Routines: sit, talk in facing groups, treat injuries (medic + patient pairs), rest/sleep on mats, share supplies (hand-over gestures), the guard; nobody idles facing nowhere > 3 s (E19 §5.1 rule).
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
- Preset `L6-subway` (no sun): cool fluorescent strips (power group `metro-main`, occasional flicker), warm camp lights in the shelter; after `l6.breach2` main power fails within 1 frame → red emergency lights (`metro-emergency`) every ≤ 15 m and the collected **headlamp** (the existing warm hero beam following the aim). E25 night readability rule: the player readable at ≥ 3:1, infected eyes the brightest pixels of each infected.
- Exit: preset `L6` (night: cool moonlight, fires on the skyline), matched by L7 at the shared Northgate exit. No weather shift at the cut (orchestrator default: dry, still night).
- Sound: shelter murmur and radio static → bangs behind the service door (breach telegraph ≥ 1.5 s before each breach) → tunnel reverb, echoing screams, the group's footsteps → the open night air at the exit.

## 6. Photo spots
`l6-shelter-calm` (people sitting, talking, treating injuries, sharing supplies), `l6-first-breach`, `l6-shelter-fails` (emergency red light), `l6-tunnel-retreat` (group + player covering the rear with the flashlight), `l6-chokepoint`, `l6-straggler`, `l6-exit-night`; **pair camera** `pair-northgate-exit` uses the same transform in L6 and L7.

## 7. Bruno references
- [`World/PoleLights.js`](../folio-2025/sources/Game/World/PoleLights.js): strip lights, power switching, emergency lamps
- [`Objects.js`](../folio-2025/sources/Game/Objects.js): crates braced into gates
- [`Fog.js`](../folio-2025/sources/Game/Fog.js): tunnel haze lit by flashlights
- [`View.js`](../folio-2025/sources/Game/View.js): tighter camera in tunnels, exit reveal

## 8. Acceptance criteria

Bots: `complete` (covers the rear, closes gates, collects stragglers), `newbie`, `evade-only` (never attacks), `idle` (stays in the shelter). Time bands are **provisional**; recalibrate on the first green single-seed run (staging §6, never padded; the group's walking pace sets the floor).

> PO 10-09: at most one single-seed complete-bot pass per level is a gate; fun/feel is judged by the PO.

| ID | Criterion | Verification |
| --- | --- | --- |
| E24-AC01 | The L6 mission graph (shelter → stop the first infected → cover the retreat → exit) is structurally completable (E12-AC07), with no fail timer and no fail on survivor death | sim |
| E24-AC02 | The `complete` bot finishes L6 on **one seed** from `L6-default` (machine gun, 5 rescued survivors) without cheats; sim time **3:00–5:00**; ≥ 60 % of all survivors exit PO 10-09: single seed. | sim |
| E24-AC03 | The `newbie` bot finishes on one seed, **3:15–5:00**, deaths ≤ 2, ≥ 40 % of survivors exit PO 10-09: single seed. | sim |
| E24-AC04 | **CHANGED 2026-10-11 — Shelter continuity:** exactly the 20–30 station occupants from L5 plus its rescued ids are present on both tiers (standalone default 24 + 0–5); all non-guard routines sit/talk/treat/rest/share are present, nobody idle facing nowhere > 3 s; no infected/combat before breach1. No duplicate or re-created survivors at the cut. | sim |
| E24-AC05 | **No new weapon:** the loadout at L6 start and end equals the L5 end loadout; no weapon pickup exists in `D-SUBWAY` | sim |
| E24-AC06 | **Breach comes from below:** every infected in L6 first appears within 3 m of a maintenance/service door or side passage outside the frustum, or arrives through the tunnel; none enters through the street stair; breach1 releases 1–2 infected, breach2 (+20–30 s) 6–10 from ≥ 2 accesses; each breach is telegraphed by door-bang audio ≥ 1.5 s before | sim |
| E24-AC07 | **Shelter fails:** `l6.abandon` fires by its first-of rule (breach2 + 15 s / ≥ 3 bitten), also with the `idle` bot; `power.off metro-main` fires within 1 frame of breach2 and emergency lights turn on; the headlamp beam switches on only when its start pickup is collected | sim |
| E24-AC08 | **CHANGED 2026-10-11 — Campaign segment regression:** `complete` runs L1→L6 on one seed, no cheats/reward screens, bat→axe→handgun→machine gun→shotgun carrying over; L5 rescued and station occupants keep ids into L6 and start at full health (orchestrator 2026-10-16: hours pass between levels). Total newbie time uses the sum of the six existing per-level bands. This is a segment, not the campaign finale; E31 owns L1→L9 continuity. | sim |
| E24-AC09 | **Covering the retreat matters:** the `evade-only` bot gets a ≤ 30 % of survivors out, the `complete` bot ≥ 60 % (one seed); the group pauses at a chokepoint when infected are within 20 m of its tail and the player is > 12 m away PO 10-09: single seed. | sim |
| E24-AC10 | **Stragglers:** injured survivors move at 1.4 m/s and become stragglers (`l6.straggler`) when > 15 m behind the tail; a straggler within 3 m of the player follows the player until rejoining; the `complete` bot rejoins ≥ 70 % of stragglers (median) | sim |
| E24-AC11 | **Chokepoints and doors:** ≥ 3 chokepoints ≤ 2.5 m wide along the route; a closed gate blocks movement and sight and holds 8–12 s against 5 infected (+ the braced HP per E26-AC09/AC10); a gate refuses to close with a survivor within 2 m of its line | sim |
| E24-AC12 | **Confined layout:** main tunnel width ≤ 8 m; no open area > 30 × 30 m outside the two stations; tunnel length 200–260 m; ≥ 3 side passages, ≥ 2 cross-passages; sight blockers every ≤ 25 m (layout test) | unit (layout) |
| E24-AC13 | **Caps and survivor infection:** concurrent infected ≤ 60 (high) / 30 (low); bitten survivors turn in 2.5–3.5 s with identity continuity; the E20-AC11 omniscience audit passes | sim |
| E24-AC14 | **CHANGED 2026-10-11 — Night exit hands to L7:** at Northgate switch to `L6` night (intensity ≤ 0.4× L4), gate closure completes L6; preserve existing caption "Night. Still alive." as orchestrator default. Load L7 at the shared exit with exactly the living survivor ids/state, full health at the new level start and carried arsenal including acquired shotgun. No reward-selection screen, credits or main menu; the existing result/Continue flow is permitted by PO 2026-10-13 level-end run-out (quoted below). L7 rocket pickup is beside this exit. | sim + e2e |
| E24-AC15 | **Underground readability:** at `l6-tunnel-retreat` and `l6-shelter-fails` the player mask contrast against its 2 m ring is ≥ 3:1 and infected eyes are the brightest pixels of each infected (E25-AC13 metric); the existing flashlight is a promoted hero light with a shadow on high only | visual |
| E24-AC16 | **Checkpoints:** dying right after `shelter`, `abandon`, `mid-tunnel`, `exit-platform` restores the snapshot (survivor states and positions, gates, power state, outbreak layer) within tolerance | sim |
| E24-AC17 | **CHANGED 2026-10-11 — Real-input playthrough:** headless Playwright mouse/keyboard from shelter to night exit and L7 handover, gate closing via `E`, one seed, zero console errors, all §6 photo spots plus `pair-northgate-exit` captured on both sides of the cut. | real-input e2e |
| E24-AC18 | **Vision review** (checklists A, D, G): `l6-shelter-calm` reads "comparatively pleasant: people sitting, talking, treating injuries, sharing supplies"; `l6-shelter-fails` reads "the shelter is failing"; `l6-tunnel-retreat` reads "strong firepower, large vulnerable group, confined space" and feels very different from the open streets of L1–L5; `l6-exit-night` reads "above ground, night". Each ≥ 7/10, no P0/P1 | vision |
| E24-AC19 | **CLARIFIED 2026-10-22 (orchestrator) — Performance:** `perf-l6-tunnel` (≥ 25 survivors moving + ≥ 40 infected on high / the low-tier cap of 30 infected on low + emergency lights + flashlight (shadow on high only)) holds each tier's E18 budgets; no frame > 50 ms at `l6.breach2` (power failure) or `l6.abandon` | perf |

## 9. Notes for implementers
- The group follower is a crowd variant of the E08 escort follower (one leader on a path, followers keep formation slots); no per-survivor pathfinding through the whole tunnel.
- E08's density table (L6 = 2–3 stragglers) is superseded for L6 (20–30 shelter survivors); update the E08-AC11 fixture when L6 is built.
- The old campaign test keeps E24-AC08 as a L1→L6 continuity regression; E31 adds the L1→L9 integration test. L10 is pending the PO storyline.

## 10. Implementation plan (2026-10-11)

All lanes ≤ 3 h, in order. Existing breaches, power failure, retreat, chokepoints and stragglers remain.

| Lane | Budget | Concrete change and reuse |
| --- | --- | --- |
| L6-S1 systems | 2 h | Preserve shotgun and L5 station cohort through `src/sim/progression/Campaign.ts`, `src/ui/CampaignUI.ts` and checkpoint snapshots; replace final-summary transition with L7 loading. |
| L6-D1 district | 2 h | Reuse `src/levels/L6/layout.ts`, `int.metro-exit`, `kit.metro-tunnel`, E25 night lights; share Northgate anchor and pair camera with E29 W6 district. |
| L6-E1 encounters + handover | 2 h | `src/data/l6.ts`, `src/sim/missions/LevelSixSubway.ts`, `src/levels/L6/mission.ts`: keep underground encounters; use 20–30 occupants on both tiers and direct L7 survivor/loadout transfer. |
| L6-Q1 Scene Lab + browser e2e | 3 h | Extend `qa-l6-*.json`, `tests/levels/L6.test.ts`, `tests/levels/campaign.test.ts` and headless `tests/e2e/levels/L6.spec.ts`: shelter ids, shotgun, night pair and zero credits/menu at L7 handover. |

Epic report rationale: AC04/08/14/17 change because L5's station occupants persist and the newly specified L7 continues at night. The older low-tier 15-person shelter conflicts with the newer PO's 20–30; optimize visual LOD/routine update frequency instead of reducing that crowd. Retain `T-E24-01`…`T-E24-19`.


## PO 2026-10-15: darkness and headlamp (binding)
PO (verbatim): "L6 overall. Make the level darker. Let the user pickup a flashlight hat at the beginning, so only the viewport is enlightened. The rest is visibile, but gray and dark" and "with some light accents here and there."
- L6 is much darker overall. At the start the courier picks up a headlamp (cap or helmet with a lamp), worn for the whole level.
- The headlamp lights a cone in the facing or aim direction in full colour. Outside it the world stays visible but desaturated grey and dark.
- Sparse light accents (lanterns, flickering strip lights, red emergency lights, signal lamps) form small coloured pools that guide the route.
- Efficiency: one spotlight (shadows on high only), no new render pass, E18 budgets hold at high and low.

PO implementation clarification: the equipment pickup is beside the start lantern, requires E / middle-click, persists in checkpoint inventory and is worn on either courier. Reuse the existing warm beam and courier glow; outside its facing cone use grey material output while emissive eyes and sparse existing practical pools keep their colour. No additional render pass. Native scream frame maximum: <50 ms desktop / <100 ms low, with and without debug.


## PO 2026-10-15: subway follow-up (spec audit)

Source: `epics-pipeline/po-bugs-1015.md` in the main workspace.

- #30, verbatim: "L6 - Tracks are disconnected". AC12 includes a continuous shared rail/sleeper/ballast kit from station to portal, rail endpoint seams ≤ 2 cm, and a station/portal Scene Lab view.
- #33, verbatim: "I heard a scream and then the game froze for 3s". AC19 includes the scream cold-start frame maximum < 50 ms desktop / < 100 ms low, with and without `?debug`; warm outbreak assets behind loading and stage arrivals. The earlier breach2/abandon limits still apply.
- #34, verbatim: "What is this?". For the service-gate task, AC11/17 require one understandable objective/progress bar, highlighted crates and target line, next-crate marker, first-push hint and gate occlusion treatment.
- #35, verbatim: "L6 is too easy because Zombies are only coming from behind, but there could be more places where they enter the tunnel, so overall more action". AC06 includes telegraphed small groups ahead/beside the player from side accesses, route engagement measurements and the retained newbie death limit. This extends the original rear-pursuit pressure; darkness and escape paths remain binding.


## PO 2026-10-13: level-end result or transition (audit clarification)

Latest all-levels decision in `po-levels-4-9-2026-10-11.md`, verbatim: "For all levels. After I reached the final checkpoint, if there is still action, then let it go for another 5s, so it doesn't feel cutted."

The source's accompanying decision says the world simulates for five seconds "before the result screen or transition" and "without action, end as now." On the orchestrator's 2026-10-16 request to apply that newest transition wording, AC14's older blanket no-summary requirement is obsolete: L6 may retain its existing result/Continue flow into L7. No reward selection, credits or main-menu ending is introduced. Living survivor ids/state, the carried arsenal, the night exit and the five-second live-action run-out remain required. This clarification changes the audited expectation; no transition code or test is relaxed by the audit.
