# E22 · Level 4: Open the Escape Route

## Goal
The town breaks down (W3, golden hour, the signature draft look): power outages, fires, blocked roads, wrecks, abandoned emergency positions. A survivor group on the radio has found the **river bridge** as the escape route. **Restore it via three parallel tasks**, fighting throughout. This level introduces the Butcher elite, the Firefighter, and the Hazmat. Twist: a huge migration heads for the bridge. Heavy weapons unlock.

## Depends on / Enables
E21, E11 (devices, hazards), D-EDGE district / E23.

## Level design
- **Hub:** the fire station apron (D-CIVIC W3), where the survivor group (3 NPCs) waits. The player gets a **fire axe** pickup here.
- **Three tasks in any order** (parallel objectives, minimap markers):
  1. **Substation** (D-EDGE): restart 3 breakers (stand-to-interact 3 s each, interrupted by damage) while Hazmat infected guard a toxic spill; fuse boxes can electrify a water puddle (hazard play).
  2. **Rail crossing via Sunset Grove Zoo** (D-ZOO → D-EDGE): the shortest way to the jammed crossing leads **through the zoo**: infected flamingos at the pond, a stampede of panicked zebras (an uninfected hazard that knocks over the player and infected alike), the **infected silverback gorilla** throwing crates and benches at the player in its broken habitat, and an infected lion pair stalking the reptile house. A zoo maintenance shed holds the fuse. Then raise the jammed crossing gates. The lever needs that fuse (the single mandatory fuse source, decision 2026-10-07). A burning **hardware truck** nearby is an optional loot/fire hazard (Firefighter infected).
  3. **Bridge blockade** (D-EDGE bridge approach): clear the wreck blockade. Push 2 wrecks with a tow pickup truck (a vehicle task: drive into the marked wrecks) **or** blow them with propane tanks.
- **Butcher elite:** spawns when the second task is completed, between the player and the hub. Mini-boss fight, 900 HP.
- **Finale:** return to the bridge; power comes on (the bridge lights cascade), and the gates rise. Cutscene: from the bridge, a migration of hundreds is seen coming over the highway ramp. "The road is open. So is the way in."
- Concurrent infected ≤ 80. Checkpoints come after each task and before the Butcher.

**Unlocks:** machine gun, rocket launcher, stronger explosives; rack 3/3.

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`World/Lightnings.js`](../folio-2025/sources/Game/World/Lightnings.js): substation arcs
- [`Cycles/DayCycles.js`](../folio-2025/sources/Game/Cycles/DayCycles.js): golden hour
- [`World/WaterSurface.js`](../folio-2025/sources/Game/World/WaterSurface.js): river at the bridge

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E22-AC01 | Mission graph completable in **all 6 task orders** (E12-AC03 applied to L4) | sim |
| E22-AC02 | The `complete` bot finishes on 20/20 seeds from `L4-default` (random task order per seed) | sim |
| E22-AC03 | The `newbie` bot finishes on ≥ 17/20 with a median of 6–10 min and median deaths ≤ 3 | sim |
| E22-AC04 | Breaker interaction is interrupted by damage and resumes at the 25% notch; the bot still completes it (no soft-lock) | sim |
| E22-AC05 | Both bridge-blockade solutions work: vehicle push (wrecks moved ≥ 4 m off the lane) and explosion (propane within 4 m) | sim |
| E22-AC06 | The Butcher spawns exactly once after the second task, telegraphs all attacks ≥ 0.5 s ahead, and its fight lasts 45–150 s for the `complete` bot | sim |
| E22-AC07 | The W3 decay layer reads: power-out blocks have ≥ 70% fewer lit windows than at W2; fires are present; the vision checklist §7.5 passes on `l4-hub`, `l4-substation`, `l4-bridge-goldenhour` | vision |
| E22-AC08 | The golden-hour lighting at `l4-bridge-goldenhour` passes the North-star checklist (§7.1) against the mockup and S10 | vision |
| E22-AC09 | Full-browser bot playthrough, with screenshots, no console errors, and perf counters within budget at `l4-substation` | e2e/perf |
| E22-AC10 | Light and power: the substation gate slot can be braced during the breaker task; completing the 3 tasks fires the **bridge lights cascade** (`power.on` events per lamp group in spline order, ≤ 0.2 s apart), and the cascade screenshot passes checklist G | sim/vision |
| E22-AC11 | Zoo route: the zoo segment contains the gorilla elite (prop throwing, E07-AC19), the lion pair, a flamingo flock, and a scripted zebra stampede (knockdown on contact, also hits infected); the `complete` bot gets through the zoo on 20/20 seeds; the zoo photo spots (`l4-zoo-gorilla`, `l4-zoo-stampede`) pass checklists A and D against `animals-pets-and-zoo.png` | sim/vision |
