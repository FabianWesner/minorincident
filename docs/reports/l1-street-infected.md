# L1 infected along the escape streets — PO 2026-10-10

Added thirteen authored groups of three infected across Juniper east, the western residential loop, Larch and Main Row. Population begins as the courier leaves the Annex toward the bat. Like L3's street population, residents enter on clear ground only outside the expanded camera frustum and at least 18 m from the courier, one every three ticks; a 5 m wander leash keeps unengaged residents near their street. Existing vision, chase, speed, damage, health and 60/30 director caps are unchanged. Member ids persist across deaths and knockdowns; there is no refill or retirement.

House entrants reserve their remaining slots within those same caps. Pending pedestrian turns and recoverable knocked-down infected also retain a slot, preventing a later turn/recovery from exceeding the cap. Street residents are already infected and empty handed; they do not create dropped hand-prop litter when populated. This corrected the first occupied-phone run's draw-call failure without changing rendering budgets.

The ten residents still emerge visibly from the original garage house. The new PO request expressly permits authored street groups/director population and supersedes the earlier single-house-only population rule. The provenance regression now recognizes authored street members alongside lab exits, house residents and bitten pedestrians. This lane did not edit specs; the main merge brought the orchestrator's updated single-seed criteria and bot-tactics work into the branch.

## Route coverage

Baseline: current main `98e9aa79` (the initial `3ff5d036` baseline reproduces exactly). Final measurement: `a8f7a8d6`; subsequent changes affect novice and browser test tactics, not the complete-policy probe. Both use the same measurement tool, seed 1, normal complete policy through bat acquisition, then input-only movement along the stated streets without attacks. The game's default on-foot pace is 4.5 m/s. At the bat the fixture restores full health and clears any pending setup death; after its first real hit it enables protection so the whole route can be measured without a respawn changing the route. No perception or attack logic is bypassed. The probe uses the game's default follow-camera geometry for off-screen spawn checks rather than the headless director's generic 64 m camera envelope.

A detection means a living infected's real L1 brain targets the courier in chase/bite mode. Each infected is counted once. Encounter windows start at the first detection and a new window starts at least 10 m farther along the walked route. The small encounter count includes only windows of 1–4 newly noticing infected. Larger systemic contacts remain in the raw evidence, detection total and gap calculation.

| Route | Small encounters before → after | Distinct infected noticing before → after | Longest gap before → after | First real damage after |
| --- | ---: | ---: | ---: | ---: |
| Direct, Juniper east → Main Row (107 m) | 3 → 7 | 6 → 18 | 66.3 → 21.6 m | 10 HP |
| West, Elm → Juniper west → Main Row (193 m) | 2 → 11 | 2 → 26 | 161.8 → 36.3 m | 10 HP |
| East, Elm → Larch/Annex → Main Row (156 m) | 5 → 8 | 9 → 13 | 70.8 → 46.5 m | 10 HP |

All three reach the station and pass ≥4 small encounters, ≥12 detections, ≤60 m maximum gap and actual damage while moving without fighting. Direct also has one six-infected contact window due to systemic spread/chasing; it is excluded from the seven small encounters. The authored groups are all three, spread across the map. Before the change, the western walker took no damage at all.

Reproduce the gated measurement remotely:

```sh
sh tools/remote/run.sh . --pull test-results/l1-street-infected/checked -- npx tsx tools/sim-runner/l1StreetRoute.ts test-results/l1-street-infected/checked --check
```

Raw comparable evidence: `test-results/l1-street-infected/{main-before,final-routes}/routes.json`; final `--check` exited zero. Final complete seed-1 bot: 137.77 simulation seconds, zero deaths, 16 bat knockdowns and 150 damage (`final-complete.json`). Final merged node and browser suites also check completion.

The denser streets exposed the novice policy's stationary auto-approach fighting. It now holds a normal keyboard movement direction while aiming bat swings at pursuers, and does not choose a random sightseeing detour with a visible threat nearby. Its 250 ms reaction and 15% missed attacks remain. Final remote novice proof: 105.13 seconds, zero deaths, three knockdowns and 30 damage (`final-newbie.json`). The remote complete, novice and ten-house-resident/cap regressions all passed (`tactics-node.json`). The real-input route uses actual ground clicks at street junctions instead of long diagonal clicks through fenced gardens.

## Inspected game-camera captures

The normal complete bot was run without god mode from the beginning to the result. The capture regression passed and saved three ordinary follow-camera frames; all three were opened and inspected at 1600×900. Positions and live infected ids/modes are in `captures/evidence.json`.

- `captures/elm.png`, courier (23.3, 37.3): one green-skinned infected visibly chases her at the garage/Elm exit. The roof fades over the courier, while the attacker remains fully visible on the pavement. Objective distance: 80 m.
- `captures/juniper.png`, courier (16.4, 15.9): two infected are separately visible across the road ahead of the courier and corgi, one chasing and one wandering. The bat, bodies and road are clearly legible. Objective distance: 61 m.
- `captures/main-row.png`, courier (14.4, −13.1), southern Juniper approaching Main Row: five infected are visible around/behind the courier, with one farther ahead beside the lamp. Previously separate groups and systemic infected converge during pursuit; this is not a single authored spawn clump. Objective distance: 38 m.

The WebGL2 and WebGPU crowd-visible guards passed: each inspected 4,455 infected samples over 2,400 ticks, with zero missing/non-finite living figures. Each run included three attacks, thirteen pedestrian turns, nine kills and the house door opening (`crowd-visible/{webgl,webgpu}.json`).

## Validation and captures

Typecheck, lint and production build passed. Remote unit/simulation results: 453 unit and 486 simulation tests passed, six skips, zero failures (`unit-sim-summary.json`, full `node.json`). The final L1 complete/novice/house-cap replay and the new director reservation regression passed remotely after the final tactics changes (`tactics-node.json`, `director-reservation.json`).

Final `npm run verify -- E19` passed typecheck, lint and build, then recorded 163 passing node tests and one failure: T-E19-06's stationary observer has 24 infected at 240 s against a minimum of 25. An isolated reproduction on unchanged main `98e9aa79` yields the identical 5/15/24/24 sample counts and fails the same assertion (`spread-baseline.json`, `spread-baseline-counts.json`). The observer never initializes street groups. The criterion was retained; this lane did not edit specs.

The broad node run additionally found failures in L2/L3 bot and corridor gates, the L1→L2 complete carryover run and L6's complete timing. L6's 270.8167 s against 270 s also reproduces on unchanged main (`main-l6.json`). The broad browser run passed 32/36, including both crowd backends, the three route captures, the bat-to-station real-input finale and browser smoke; its L1 playthroughs are being replayed with the final junction/moving-bat tactics, alongside the failed L3 commerce route. L5's real-input route found only two of five survivors. These results are not presented as an all-green full levels suite.

Final real-input replay, all-project browser smoke and high/phone performance results are pending shared browser locks. The added occupied-street test retains high p95 ≤14 ms, phone 4× CPU p50 ≤33.33 ms, draws ≤600/300 and triangles ≤1,500,000/500,000; existing L1 photo/transition budgets run unchanged. The first quiet run passed seven of nine checks; occupied-phone draw calls were 357 before empty-handed street population, and desktop pickup had a 126.6 ms frame. The final quiet rerun measures both again.

No deployment, push or merge into main. Main was merged into this worktree, including `98e9aa79` (bot-tactics).
