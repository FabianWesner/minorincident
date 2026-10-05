# E23 · Level 5: Hold the Line

## Goal
The evacuation has begun (W4, dusk). The goal changes from escaping to protecting others. **Keep the route open until the survivor convoy gets through**, across four **fallback positions**: residential street → gas station → checkpoint → bridge. The player's build is powerful; the hordes are bigger. This level introduces the Armored and the Nurse. Twist: the bridge charges blow early, and the player is cut off from the convoy. Final-tier upgrades unlock.

## Depends on / Enables
E22, E08 (convoy) / E24.

## Level design
- **Convoy:** a school bus, an ambulance, 2 pickups, and a military truck on a spline. They have shared **convoy HP** (0 = mission failed) and stop when the lane ahead is blocked (infected on the lane or a wreck) until it is cleared.
- **Positions** (each: prep 20 s → waves → fallback signal):

| Position | District | Duration | Features | Wave content |
| --- | --- | --- | --- | --- |
| P1 Residential street | D-RES W4 | 90 s | barricaded houses, propane grills, a drivable SUV | runners, crawlers, Screamer |
| P2 Gas station | D-MAIN W4 | 100 s | **pumps = giant hazard** (one-time detonation, clears the forecourt), a deployable turret | runners, Brutes, Bloated, a Nurse |
| P3 Checkpoint | D-CIVIC W4 | 110 s | floodlights (a generator must stay on), crowd fences, an abandoned police cruiser (siren lure) | Riot, Armored, Sprinters |
| P4 Bridge | D-EDGE W4 | 120 s | a choke point; the convoy crosses slowly; a migration arrives | everything, a peak of 150 concurrent |

- **Fallback:** "Fall back!" radio; the player has 30 s to reach the next position. The convoy moves ahead. The car is optional.
- **Twist:** the last convoy vehicle crosses; the soldiers blow the bridge early with the player on the wrong side. "Convoy clear. Bridge down. You're on your own."

Checkpoints come at the start of each position (convoy HP is restored to its value at that checkpoint).

## Bruno references
Reuse first, per the [reuse map](08-bruno-reuse-map.md). Read these before writing new code:
- [`Explosions.js`](../folio-2025/sources/Game/Explosions.js): gas-station chain
- [`World/Fireballs.js`](../folio-2025/sources/Game/World/Fireballs.js): fireballs
- [`Objects.js`](../folio-2025/sources/Game/Objects.js): barricade props
- [`World/PoleLights.js`](../folio-2025/sources/Game/World/PoleLights.js): street lamps at dusk

## Acceptance criteria

| ID | Criterion | Verification |
| --- | --- | --- |
| E23-AC01 | Mission graph completable (E12-AC07) | sim |
| E23-AC02 | The `complete` bot finishes on 20/20 seeds from `L5-default`; median convoy HP at the end ≥ 40% | sim |
| E23-AC03 | The `newbie` bot finishes on ≥ 16/20 with a median of 7–10 min and median deaths ≤ 3 | sim |
| E23-AC04 | Concurrency reaches ≥ 140 at P4 for the high tier (scaled to 70 at low) and never exceeds the cap | sim |
| E23-AC05 | Convoy stop/go: an infected on the lane within 8 m ahead stops the convoy; clearing it resumes the convoy within 1 s; the convoy never drives through static blockers | sim |
| E23-AC06 | The gas station mega-hazard detonates once, kills ≥ 80% of the infected in its 12 m radius, and cannot damage the convoy (the convoy route is outside the radius, as a geometry check) | sim |
| E23-AC07 | Power check: the player power score at the L5 start ≥ 3× the L1 end score (default path) | unit |
| E23-AC08 | Performance: `perf-l5-bridge` (P4 peak) is within the high-tier budgets (draw calls, triangles, sim p95) | perf |
| E23-AC09 | Full-browser bot playthrough, with screenshots at P1–P4 and the twist, no console errors | e2e |
| E23-AC10 | Vision: `l5-gas-station-wave` and `l5-bridge-peak` pass §7.4 (player readable inside the horde, telegraphs visible, convoy distinguishable) and §7.5 (W4 overrun reads) | vision |
| E23-AC11 | Prep phases: each position has a 20 s prep with 3–5 barricade slots and ≥ 2× the props needed to fill them; the `complete` bot braces ≥ 2 slots per position; an A/B sim (barricades disabled vs enabled, 10 seeds) shows ≥ 30% less convoy damage with barricades | sim |
