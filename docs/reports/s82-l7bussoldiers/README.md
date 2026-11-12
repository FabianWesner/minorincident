# L7 bus and support-soldier clearance

## Finding

The evacuation bus waits for every campaign survivor in its boarding roster, but the eight armed support soldiers are a separate ally group. Four follow the courier and had no bus-clearance rule, so the departure path could drive the bus through them. The supplied PO capture shows two support soldiers inside the front bumper after departure began.

## Change

`LevelSevenDeparture` now treats support soldiers as external bodies. When a soldier is within 0.5 m of the parked bus or its next departure pose, the soldier continuously steps to a spaced road-shoulder position. The bus holds its route clock until clearance is restored. It then resumes the authored route and nine-second departure timing. Encounter composition, pacing before departure, zombie stats, and corpse persistence are unchanged.

## Verification

- `tools/qa/l7-bus-clearance.ts`: six complete native L7 runs (skilled and passive, seeds 1–3), sampled every simulation tick through arrival, boarding, and departure. All six completed with zero clearance flags and no offender samples. Minimum external ally/survivor hull clearance was **0.5249 m** (passive seed 3); the other five minima ranged from 1.4862 m to 2.2218 m. Seated bus passengers are excluded because they are intentionally inside the hull. The passive probe applies no attacks from the bus-arrival ring onward and makes the courier invulnerable, matching the passive policy while allowing the native route to reach boarding.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Remote `npm test`: passed on 46.225.66.90 in 209.2 s: 27 files, 106 passed and 1 skipped; collection budget receipt 150/150 cases.
- `git diff --check`: passed.
- `threat-audit --levels L7`: L7 report has **0 flags**. The command exits nonzero because its aggregate report adds `PARTIAL_LEVEL_SELECTION:diagnostic run, not a complete gate` when only L7 is selected; this is a selection marker, not an L7 gameplay flag. Passive audit reached its 1200-second tick budget; skilled L7 completed.
- Scene Lab capture at HIGH quality and zoom 1 / 1.5 remains unmeasured. `scene:catalog` exited 75 before launching a browser: the permitted browser-pool startup failed with `listen EPERM` on `127.0.0.1:4329`. After the sandbox restriction was lifted, the pool launched successfully. Both zoom captures then failed during fixture setup because the opening encounter point (267.5,12) lies outside the scene bounds. A temporary wider-bounds fixture passed that stage but failed in `LevelSevenEncounters.formationGoal` because Scene Lab has no mission controller. No capture was created or reviewed, so there is no visual claim in this report.

## Open acceptance item

Run the two required Scene Lab captures through the browser pool, open them, describe the boarding moment, and attach the reviewed small sheet here. The gameplay clearance probe and L7 threat flags pass; the visual review is the remaining acceptance item.
