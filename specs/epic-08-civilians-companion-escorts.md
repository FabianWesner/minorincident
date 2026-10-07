# E08 · Civilians, Corgi Companion and Escorts

## Goal
Make the world feel inhabited before it falls. Civilians go about routines, panic, flee, and can turn. The **corgi** follows and helps. **Escort NPCs** follow the player and must survive (L2, L5 convoy members, L6 none).

## Depends on / Enables
E07 / E19, E20, E23.

## Scope
**In:**
- **Civilians (regular people), fewer every level:** adults and older teens walk around on waypoint routines (walk the dog, shop, jog, wait at the bus stop, chat, later: carry belongings, flee to cars). States: `calm → alarmed → flee → (hide) → grabbed → bitten → down → rising → infected`.
  - **Density per level** (concurrent ambient civilians on the active map, high tier; low tier ×0.6):

    | L1 | L2 | L3 | L4 | L5 | L6 |
    | --- | --- | --- | --- | --- | --- |
    | 60 | 40 | 24 | 12 | 6 | 2–3 stragglers |

    > **Level 2–6 redesign (PO, 2026-10-07):** the L2–L6 cast counts are now set by the level epics (L2 ≈ 30 trapped + ~10 street civilians; L3 few stragglers plus police allies; L4 ≈ 50 crowd civilians, many armed, plus ≈ 20 soldiers; L5 5 survivors; L6 20–30 shelter survivors). The L2–L6 columns above and the E08-AC11 fixture are updated when each redesigned level is built (E20–E24 notes). Escorts in the redesign never fail the mission on death (`failOnDeath: false`).

  - **The turning cycle** (the outbreak spreads in front of the player; all timings come from data and are seeded):
    1. **Grab** (1.5 s): an infected grabs a civilian, who screams and struggles. **Rescue window:** killing or knocking back the attacker during the grab saves the civilian (they flee; `civilian.saved`, counted in the level result and in an optional objective).
    2. **Bite → stagger** (1–2 s): the civilian stumbles away and clutches the wound.
    3. **Down** (4–8 s): they collapse and **lie on the ground**, twitching harder, veins darkening, and **the eyes start glowing red in the last 2 s**. Audio: gasping → silence → a low growl.
    4. **Rising** (1.2 s get-up animation, vulnerable): they stand up as an **infected** whose visual variant matches the civilian's clothes (jogger → `inf.jogger`, cashier → `inf.cashier`, BBQ dad → `inf.bbq-dad`, …).
    5. **Prevent:** during the **eyes-glowing phase** (the last 50% of *down*) a melee hit or shot **finishes** the body, and it never rises (`civilian.finished`). Before that phase the person is still human, and player weapons do nothing to them.
  - **The player cannot hurt living civilians:** bullets and melee pass through them; explosions knock them down but don't kill them.
  - **Spread and caps:** each turned civilian counts against the level's concurrent-infected cap. If the cap is full, the rise is delayed until there is room, so the cap is never exceeded. A per-level `turnChainLimit` keeps L1 from snowballing.
  - Some turns are **scripted** (story beats: the L1 diner incident). Others are **systemic** (any infected near a civilian may grab them; the grab chance is per archetype).
  - **Pets:** civilians on the "walk the dog" routine have a dog; if the owner is attacked, the dog may be infected too (*down* only 2–4 s, then rises as an infected dog). Stray cats can turn the same way. The **corgi is immune** and never turns.
  - **Children are never part of the infection loop:** child NPCs (the brother, kids at the school and the evacuation buses) only appear in protected, scripted contexts. Infected never target them, they cannot be bitten, gored, or infected, and the brother as an escort can only be *knocked down* (downed state), never bitten. (Decision R1.)
- **Traffic (W0–W1):** simple lane-following cars that stop for the player and civilians and panic-drive at W1 (cosmetic, kinematic; can be hit by the player car at L3+).
- **Corgi:** follows at 1.5–4 m, avoids crowds, barks at threats within 18 m that are off-screen (directional HUD ping), fetches pickups within 6 m, cannot die (it hides at 0 "courage" and recovers in 10 s), and slots an ability (`corgi lure`) via E06.
- **Escorts:** follow at 2–5 m along the path; stop when the player stops; hide behind cover when infected are within 8 m; have HP and a downed state (revive by stand-to-interact for 2 s); fail the mission if they die. The order "wait here" (stand-to-interact on the escort) toggles follow/wait.
- **Convoy (L5):** a vehicle group on a spline with HP and a stop/go state driven by the blockage ahead.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`World/Bubble.js`](../folio-2025/sources/Game/World/Bubble.js): corgi bark ping pattern
- [`InteractivePoints.js`](../folio-2025/sources/Game/InteractivePoints.js): escort wait/follow interaction

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E08-AC01 | In the `civ-street` scenario at W0, 30 civilians run routines for 5 min without getting stuck (no civilian displaced < 0.5 m over 20 s while in a moving state) | sim |
| E08-AC02 | When an infected attacks within 12 m, nearby civilians enter `flee` within 0.5 s and move away from the threat (distance to the threat increases over 3 s) | sim |
| E08-AC03 | Turning cycle: grab (1.5 s) → bite/stagger (1–2 s) → down (4–8 s, seeded) → rising (1.2 s) → `civilian.turned`, spawning the mapped infected variant at the body position; the event sequence and timings hold within ±1 tick over 50 seeded turns; the eyes-glow flag is set exactly for the last 2 s of *down* | sim |
| E08-AC04 | Corgi stays within 6 m of the player 95% of the time during a 3-minute bot run with combat; it never blocks the player's path for more than 0.5 s | sim |
| E08-AC05 | Corgi off-screen warning: an infected approaching from outside the frustum within 18 m triggers a `corgi.bark` event with a direction | sim/e2e |
| E08-AC06 | Escort follow: an escort follows a bot-driven player through `maze` and arrives within 6 m of the player at the exit, with no wall crossings | sim |
| E08-AC07 | Escort downed → revive: at 0 HP the escort is downed for 20 s; standing near it for 2 s revives it at 50% HP; if not revived in time, `mission.failed` fires with reason `escort-died` | sim |
| E08-AC08 | Wait/follow toggle works via interaction and is shown by an icon over the escort | e2e |
| E08-AC09 | Traffic stops for a pedestrian in its lane within its braking distance; no traffic car ever overlaps a civilian | sim |
| E08-AC10 | Corgi model placeholder or final has its required nodes; the turntable passes the character checklist against S01 (once final) | unit/vision |
| E08-AC11 | Density per level: the ambient civilian count stays within ±10% of the per-level table (L1 60 → L6 2–3; low tier ×0.6), measured as the average over each level's first 3 minutes in the `complete` bot runs | sim |
| E08-AC12 | Rescue window: killing or knocking back the attacker during the 1.5 s grab saves the civilian (`civilian.saved`, the civilian flees, no turn); after the bite, rescue is no longer possible | sim |
| E08-AC13 | Finishing: a hit during the eyes-glow phase emits `civilian.finished`, and no infected rises; a hit before that phase has no effect, and player weapons never damage living civilians (100 shots through a crowd → 0 civilian damage events) | sim |
| E08-AC14 | Caps: with the concurrent-infected cap full, rising is postponed (the body stays down) until there is room; the cap is never exceeded during an L1 run with forced mass turning | sim |
| E08-AC15 | Children: child NPCs are never targeted (no `grab`/`attack` events with a child target over a full L2 run), cannot enter the bite/turn states, have gore disabled, and the brother escort uses only the downed state | sim |
| E08-AC16 | Visual: the down → rising sequence screenshot set (`turning-probe`, 5 frames) shows the lying body, the darkened veins, the glowing eyes, and the get-up; it passes a vision check that the person reads as a civilian turning (not as an infected corpse) | visual/vision |
| E08-AC17 | Pets: a walked dog whose owner is grabbed turns with a probability from the data (seeded) after a 2–4 s *down*; the corgi never enters any infection state (no event across a full L1–L6 bot campaign) | sim |
