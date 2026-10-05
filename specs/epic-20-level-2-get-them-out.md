# E20 · Level 2: Get Them Out

## Goal
The outbreak is public (W1, midday). Panic, leaving cars, arriving police. Reach the people who matter (**the younger brother at Sunset Grove Elementary** and **neighbor Mrs. Alvarez**) and escort them to the **evacuation buses at the baseball field**. This level introduces **firearms, throwables, the second rack slot, and the selector**, along with larger groups, the Brute, and the Screamer. Twist: the evacuation point is overrun as the last bus leaves.

## Depends on / Enables
E19, E08 (escorts), E13 (rack 2/2) / E21.

## Level design

| Segment | District | Beats | New | Target |
| --- | --- | --- | --- | --- |
| 1. Home street | D-RES W1 | A police cruiser blocks the street; a dead officer drops a **pistol** (the pickup forces the "second slot" lesson: the pistol goes to RIGHT, kick moves to the rack). Mrs. Alvarez is barricaded in her house: stand-to-interact at the door, then she joins as an escort. | firearm, noise lure, rack 2/2, selector | 2:00 |
| 2. To the school | D-RES → D-SCHOOL | The street is blocked by panicked traffic jams; a hardware box gives **2 Molotovs** (throwable). A Screamer near the playground teaches priority targets. | throwable, Screamer | 2:00 |
| 3. School | D-SCHOOL entrance + gym | Find the brother in the gym (a hold-out with a teacher NPC). A **Brute** breaks through the gym doors (mini-fight). The brother joins (2 escorts). Escorts can be told to wait. | Brute, escort management | 2:30 |
| 4. Evacuation | D-PARK baseball field | Reach the buses through the park; the final push holds 60 s at the bus while the escorts board (`defend` objective). | defend | 1:30 |
| 5. Twist | Cutscene | The buses leave; the field fence breaks; the player is left behind with the corgi. "They got out. You didn't." | — | 0:20 |

Concurrent infected ≤ 40. Checkpoints come at segments 2, 3, and 4.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Objects.js`](../folio-2025/sources/Game/Objects.js): pushable lockers and benches for the gym
- [`World/VisualVehicle.js`](../folio-2025/sources/Game/World/VisualVehicle.js): police car blinkers and sirens

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E20-AC01 | Mission graph completable (E12-AC07) | sim |
| E20-AC02 | The `complete` bot finishes L2 on 20/20 seeds starting from the `L2-default` progression | sim |
| E20-AC03 | The `newbie` bot finishes on ≥ 18/20, with a median of **5–10 min** and median deaths ≤ 2; median escort downs ≤ 2 | sim |
| E20-AC04 | Both escorts survive in ≥ 90% of the `complete` bot runs (escort AI not suicidal) | sim |
| E20-AC05 | The pistol pickup in segment 1 produces a loadout of LEFT = [melee], RIGHT = [pistol, kick], and the selector tutorial prompt appears | sim/e2e |
| E20-AC06 | Firearm noise visibly changes AI: in segment 1, the pistol shots alert ≥ 3 infected from beyond line of sight (event log) | sim |
| E20-AC07 | The Screamer's scream summons are capped so the concurrent count never exceeds 40 | sim |
| E20-AC08 | The `defend` step at the bus lasts 60 s ±1 tick; failure only if the player dies (the escorts are inside the bus, invulnerable) | sim |
| E20-AC09 | Full-browser bot playthrough with screenshots at the L2 photo spots; no console errors | e2e |
| E20-AC10 | Vision: `l2-panic-street` (W1 panic reads: traffic jam, police, fleeing people vs the W0 L1 spot), `l2-school-gym`, `l2-baseball-evac` pass §7.1/§7.4/§7.5 | vision |
| E20-AC11 | End-of-level flow: unlock reveal (pistol/shotgun choice + Molotov) → upgrade cards → rack setup (2/2) works | e2e |
| E20-AC12 | Barricades: Mrs. Alvarez's house uses a board-up point; in the gym, lockers and benches can be pushed into the door slot and braced; an A/B sim over 10 seeds shows the braced door delays the Brute's breakthrough by ≥ 10 s vs unbraced | sim |
