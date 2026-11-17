# s160 — L4 Harbor escape pressure

## Result

The native HUD-marker policy completed L4 on HIGH and LOW for seeds 1–3, with **0–3 escape deaths in every run**. All six runs completed, so the ≤5 target passes. The policy followed the same changing route marker exposed by `markerAnchor`, used ordinary movement/interact inputs, and attacked only threats returned by the existing line-of-sight combat policy. No browser or damage/stat/corpse/count override was used.

| Seed | HIGH escape deaths | LOW escape deaths | HIGH total deaths | LOW total deaths |
|---:|---:|---:|---:|---:|
| 1 | 0 | 1 | 8 | 7 |
| 2 | 3 | 0 | 11 | 5 |
| 3 | 0 | 0 | 9 | 8 |

## Harbor crowd observations

The observer counts living, admitted infected within 18 m while the courier is on the Harbor corridor. It separately counts unobstructed navigation-grid line of sight and the subset ahead of the current HUD marker. This is sim visibility evidence, not a camera/render visibility claim.

| Tier / seed | Local peak | With clear sim LOS | Ahead of marker | Position (m) | Peak mix |
|---|---:|---:|---:|---|---|
| HIGH / 1 | 26 | 3 | 2 | (−5.2, −37.4) | 8 firefighters, 5 crawlers, 5 butchers, 3 hazmats, 3 brutes, 2 sprinters |
| HIGH / 2 | 48 | 28 | 0 | (−27.8, −37.7) | 10 hazmats, 9 firefighters, 8 riot, 7 crawlers, 4 brutes, 4 Alphas, 3 armored, 3 butchers |
| HIGH / 3 | 13 | 10 | 1 | (−66.9, −38.0) | 3 armored, 3 riot, 2 runners, and one each butcher, brute, firefighter, Alpha, hazmat |
| LOW / 1 | 6 | 5 | 0 | (−59.3, −39.1) | 2 butchers, one each runner, riot, Alpha, firefighter |
| LOW / 2 | 35 | 13 | 1 | (−14.9, −16.7) | 6 armored, 6 sprinters, 4 each hazmat, riot, butcher, firefighter; 3 brutes, 2 each runner/crawler |
| LOW / 3 | 1 | 0 | 0 | (−24.4, −37.4) | one crawler |

At the largest local peak, HIGH seed 2 had a dense crowd near the westbound street, but its nearest listed threats were at the courier’s side/behind the marker bearing. The most direct ahead samples were two bodies at about 14–15 m in HIGH seed 1, one butcher at 1.7 m in LOW seed 2, and one runner at 7.9 m in HIGH seed 3. The native combat policy completed these routes within the death target. Full positions, archetype counts, LOS lists, marker positions, and death positions are in [qa.json](qa.json).

No level-design change was needed for this native acceptance policy. Zombie definitions, population totals, encounter counts, corpse persistence, and the L4 layout are unchanged. This result does not replace visual review of the camera view or the separate real-input LOW diagnostic that recorded six Harbor escape deaths.

## Preserved receipts and checks

- The s151 and s154 reports and their receipts were left untouched: [s151 L4 HIGH](../s151-l4high/README.md), [s154 LOW exits](../s154-lowexits/README.md).
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm test -- tests/engine/l4-contact.test.ts --maxWorkers=1` — passed, 28.7 s.
- Full `npm run qa:threat -- --maxWorkers=4` — **0 fail flags**, 361.5 s.
- The prescribed `sh tools/remote/run.sh "$PWD" -- npm test` passed on 46.225.66.90 in 175.8 s within the 240 s budget: 150/150 inventory, 27 files passed, 105 tests passed and one skipped.

Reproduce the native matrix with `node --import tsx tools/qa/s160-l4-visible.mts`. The runner hook follows the dynamic HUD marker and retains the existing ordinary visible-threat combat policy.

## Browser QA needed

This lane did not open a browser. At **tick 29,933**, courier near **(5.1, −34.9)**, inspect L4 at **HIGH and LOW**: check whether the dense Harbor crowd lies ahead in the actual camera view, how much of its armored/heavy mix is visible before contact, whether the route marker and warning communicate a safe path, and whether ordinary combat/escape input still stays within five escape deaths. Also review **tick 20,963**, same reported position and approximately 17 m from the marker, for marker distance/turn clarity against the batch-116 capture.
