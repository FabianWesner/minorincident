# s93-l10finale

All six native seed/tier cases complete with no attack-start gap over 45 s outside the unchanged 56 s protected hangar dialogue. All attack rates meet or exceed the reproduced s89 source. The goal is verified complete.

## Cause and changes

The native trace confirms a journey retry at tick 26281 rewinds the living Mega from x=2292.408 to x=1897, discarding about 395 m of pursuit. At cure installation it is about 1,615 m away. The strict finale director also counts recoverable downed infected: at 1200 s, 15 of 22 slots are downed within about 5–12 m of the courier. Waves cannot simply replace those reserved bodies. [Trace evidence](trace.json) and [reproducer](../../../tools/qa/s93-l10trace.ts).

- Retain the same living Mega entity’s walked transform across checkpoint death retries when its ID exists in the snapshot. Checkpoint HP/timers, killed-boss retention and the existing fairness gap remain; live-save resumes are untouched.
- Keep assault mode and the 14 LOW / 22 HIGH budget through cure release.
- Author eight ordinary journey-arrival slots on LOW and twelve on HIGH. Existing quiet trigger, safe placement, reservation checks and caps remain. No infected/weapon stats, attack observer, bot policy, gap threshold, threat thresholds or corpse lifecycle changed.

## Native verification

| Seed | Tier | Longest gap (s) | Starts/min before → after | Complete |
| --- | --- | --- | --- | --- |
| 1 | low | 42.12 | 13.395 → 13.395 | Yes |
| 1 | high | 33.65 | 12.715 → 21.014 | Yes |
| 2 | low | 43.28 | 15.190 → 15.190 | Yes |
| 2 | high | 28.63 | 14.605 → 25.626 | Yes |
| 3 | low | 42.23 | 16.876 → 20.506 | Yes |
| 3 | high | 26.52 | 17.699 → 23.153 | Yes |

[Native receipt](native-validation.json). Reproduce: `S89_OUT=/private/tmp/s93-final.json node --import tsx/esm tools/qa/s89-l10gap.ts`. Every rate was compared numerically against the original `/private/tmp/s93-cadence.json` reproduction. Resident infected peaks are 62–70, zero observed cap violations. No finale cap was raised.

## Checks

Typecheck and lint pass. L10 threat audit finishes in 50.7 s with no gameplay flags; exit 1 is solely the standard `PARTIAL_LEVEL_SELECTION` diagnostic flag. Remote `sh tools/remote/run.sh "$PWD" -- npm test` passes on 46.225.66.90: 106 passed, one skipped, 27 files, 216.9/240 s.

## Browser QA needed

No browser was run. Human QA should inspect sustained action, arrival visibility/occlusion, corpse persistence, the Mega checkpoint transition and LOW/HIGH frame time. No visual or renderer-performance pass is claimed. No deployment, push or main movement occurred.

Rejected experiments included retargeting, sound-focus protection, faster assault periods, composition/order changes, east entry and twelve arrivals on LOW. They failed cadence, rates or completion and are reverted. The final source contains only the three changes above.
