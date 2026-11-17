# s160 — L4 Harbor escape pressure

## Result

The native marker policy completed HIGH and LOW on seeds 1–3 with at most **one escape death** per run. During collapse it follows the dynamic HUD marker and attacks nearby threats with clear simulation line of sight inside the native follow-camera frustum. It does not use the completion bot's route, pickup, or detour choices. It walks through intermediate rings and interacts when near a marker. The local navigation grid models obstacle avoidance, and line of sight is a simulation approximation rather than proof of rendered visibility.

| Seed | HIGH escape deaths | LOW escape deaths | HIGH total deaths | LOW total deaths |
|---:|---:|---:|---:|---:|
| 1 | 0 | 1 | 8 | 7 |
| 2 | 1 | 0 | 9 | 5 |
| 3 | 0 | 0 | 9 | 8 |

## Harbor crowd observations

The observer counts admitted living infected within 18 m in the Harbor corridor. Clear line of sight uses the simulation navigation grid; ahead means on the marker side of the courier. Details, positions and archetype mixes are in [qa.json](qa.json).

| Tier / seed | Local peak | Clear LOS | Ahead | Position (m) |
|---|---:|---:|---:|---|
| HIGH / 1 | 21 | 4 | 0 | (−5.2, −37.4) |
| HIGH / 2 | 1 | 1 | 0 | (9.0, −37.3) |
| HIGH / 3 | 2 | 1 | 0 | (−52.9, −38.5) |
| LOW / 1 | 14 | 5 | 0 | (−27.5, −37.6) |
| LOW / 2 | 35 | 13 | 1 | (−14.9, −16.7) |
| LOW / 3 | 3 | 0 | 0 | (−64.4, −39.4) |

The LOW seed 2 peak included six armored, six sprinters, four each hazmat, riot, butcher and firefighter, three brutes, and two each runner and crawler. One butcher was ahead at 1.7 m. This simulation cannot establish what the camera actually renders; browser review remains necessary. No level design or zombie data changed.

## Preserved receipts and checks

- The s151 and s154 reports and their receipts were left untouched: [s151 L4 HIGH](../s151-l4high/README.md), [s154 LOW exits](../s154-lowexits/README.md).
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test -- tests/engine/l4-contact.test.ts --maxWorkers=1` — passed, 28.7 s.
- Full `npm run qa:threat -- --maxWorkers=4` — **0 fail flags**, 361.5 s.
- The prescribed `sh tools/remote/run.sh "$PWD" -- npm test` passed on 46.225.66.90 in 173.1 s within the 240 s budget: 150/150 inventory, 27 files passed, 105 tests passed and one skipped.

Reproduce the native matrix with `node --import tsx tools/qa/s160-l4-visible.mts`. The collapse controller follows the dynamic HUD marker and uses nearby line-of-sight combat restricted to the native camera frustum; the existing bot handles the earlier defense and cellar interaction.

## Browser QA needed

This lane did not open a browser. At **tick 29,933**, courier near **(5.1, −34.9)**, inspect L4 at **HIGH and LOW**: check whether the dense Harbor crowd lies ahead in the actual camera view, how much of its armored/heavy mix is visible before contact, whether the route marker and warning communicate a safe path, and whether ordinary combat/escape input still stays within five escape deaths. Also review **tick 20,963**, same reported position and approximately 17 m from the marker, for marker distance/turn clarity against the batch-116 capture.
