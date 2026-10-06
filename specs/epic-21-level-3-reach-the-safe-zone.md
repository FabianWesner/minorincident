# E21 · Level 3: Reach the Safe Zone

## Goal
Emergency response (W2, afternoon): checkpoints, barriers, blood trails, abandoned belongings. Cross the town to the **Civic Center safe zone before access closes** (a timer). The map is more open with **route choice**. This level introduces **vehicles**, the Sprinter, the Riot, and the Bloated. Twist: infected appear inside the perimeter, and the safe zone collapses.

## Depends on / Enables
E20, E09 / E22.

## Level design

| Segment | District | Beats | New | Target |
| --- | --- | --- | --- | --- |
| 1. Broadcast | D-MAIN W2 | A radio broadcast starts the **12:00 min timer** ("Civic Center gates close at 16:00"). Abandoned cars line Main Street. | timer | 0:30 |
| 2. Get a car | D-MAIN gas station | The keys are in a sedan at the pumps (the stand-to-interact door). The car tutorial: drive, run over, smash cones and barricades. A propane hazard at the pumps. | **vehicle**, hazards | 1:30 |
| 3. Route choice | D-MAIN → D-SHOP or D-PARK | **Route A, the Supermarket lot:** fast road but a Riot police line blocks it (bypass on foot through the supermarket). **Route B, the Park road:** longer, open, Sprinters, the car stays usable. Both converge at the Civic approach. | route choice, Sprinter, Riot | 3:00 |
| 4. Checkpoint | D-CIVIC police checkpoint | The car is stopped by a heavy barrier (vehicles are forced to exit). The checkpoint is half-overrun: clear it (Bloated introduced next to the barrier: its explosion breaks the barrier as an alternative solution). | Bloated, combat in tight space | 2:00 |
| 5. Gates | D-CIVIC safe-zone camp | Reach the gate before the timer ends; the gate guards open it. | — | 0:30 |
| 6. Twist | Cutscene | A medic tent patient turns; screams spread inside the fence; floodlights fail. "The safe zone has fallen." | — | 0:20 |

Concurrent infected ≤ 60. The timer is generous: the `newbie` bot median finishes with ≥ 2:00 left.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Physics/PhysicsVehicle.js`](../folio-2025/sources/Game/Physics/PhysicsVehicle.js): first drivable car
- [`World/VisualVehicle.js`](../folio-2025/sources/Game/World/VisualVehicle.js): car view
- [`Tracks.js`](../folio-2025/sources/Game/Tracks.js): tire tracks

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E21-AC01 | Mission graph completable (E12-AC07) for **both routes** | sim |
| E21-AC02 | The `complete` bot finishes on 20/20 seeds for each route (forced route) from `L3-default` | sim |
| E21-AC03 | The `newbie` bot finishes on ≥ 18/20 with a median of 5–10 min, deaths ≤ 2, and timer remaining ≥ 120 s median | sim |
| E21-AC04 | The vehicle tutorial is completed by the bot: enter, drive, at least 5 run-over kills, and at least 3 smashed light obstacles (events) | sim |
| E21-AC05 | The two routes differ in measured time by ≤ 30% for the `complete` bot (both viable) | sim |
| E21-AC06 | The heavy barrier at segment 4 cannot be driven through (car stops), but a Bloated explosion within 3 m or a propane blast destroys it | sim |
| E21-AC07 | Timer expiry → `mission.failed{reason:'timeout'}` → retry from the last checkpoint with the timer restored to its checkpoint value + 60 s grace | sim |
| E21-AC08 | Full-browser bot playthrough (both routes) with screenshots, no console errors, and driving at time scale 2 | e2e |
| E21-AC09 | Vision: `l3-mainstreet-w2` (emergency response reads: barriers, cones, blood trails, abandoned belongings), `l3-driving`, `l3-checkpoint`, `l3-safe-zone` pass §7.1/§7.5 | vision |
| E21-AC10 | Carried over from E08-AC11: in L3 `complete` campaign-bot runs, average concurrent ambient civilians over the first 3 minutes stays within ±10% of the L3 target (24 high tier; low tier ×0.6), measured at both tiers. | sim |
| E21-AC11 | Carried over from E08-AC17: across full L3 `complete` campaign-bot runs, the corgi never enters an infection state and has no infection event; retain the event log for continuous-campaign verification in E24. | sim |
