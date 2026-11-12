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
- Scene Lab HIGH/WebGL2 at zoom 1 and 1.5: **2/2 passed**, headless, one browser, port 4917. Opened both sheets and the combined [boarding review](boarding-review.jpg). Frames 0–400 show the group approaching the parked bus; frames 500–1100 show the lit bus and external actors in the departure view. The wider zoom includes more of the crossing and road. Images document the sequence; the native probe supplies the quantitative clearance assertion.

## Capture reproduction

The original scene bounds exclude the opening encounter setup at (267.5,12). For this review, copy `tests/scenes/l7-departure/departure.json` to a temporary scene directory and set `layout.bbox` to `[[-100,-20],[290,80]]`; all actors, events and camera settings remain authored. Run `SCENE_PORT=4917 npm run scene:catalog -- --dir <temporary-directory> --matrix --tier high --backend webgl2 --jobs 1 --only l7-departure@high-z1,l7-departure@high-z1.5 --out <output-directory>`.

The follower formation now tolerates the missing mission controller in Scene Lab. Production missions still use the same departure state check. No threat harness files changed.
