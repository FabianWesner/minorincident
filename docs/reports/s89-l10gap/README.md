# s89-l10gap

Five of six native seed/tier cases meet the 45-second attack-start gap target. All six complete and exceed baseline attack rates. **HIGH seed 3 remains open at 170.62 seconds; the full original goal is not complete.**

## Changes

- Outpaced ordinary L10 hunters stop pursuing an unseen courier; distant hunters behind her are not immediately reassigned. Existing streaming preserves their entities and positions.
- The encounter manager requests ordinary catalog sprinters after 15 quiet seconds, checked every five seconds. Placement retains offscreen/occlusion, nav, resident-cap, reservation and hangar checks. Journey arrivals stop after cure installation, including retries; quiet timing is checkpointed.
- Journey headroom increases within E18 ceilings, with a later HIGH ramp in the corridor/complex. Finale caps remain 14 LOW / 22 HIGH. No infected/weapon stats, bot policy, corpse lifecycle or threat-audit thresholds changed.

## Native before/after

Same native complete input policy and attack-start observer, seeds 1–3, LOW/HIGH. Exactly 56 seconds of protected hangar dialogue are excluded from gaps. Rates use first attack to final simulation tick in both measurements.

| Seed | Tier | Gap before → after (s) | Starts/min before → after | Complete |
| --- | --- | --- | --- | --- |
| 1 | low | 295.07 → 42.12 | 1.896 → 13.395 | Yes |
| 1 | high | 356.17 → 44.70 | 6.520 → 12.715 | Yes |
| 2 | low | 298.70 → 43.28 | 3.376 → 15.190 | Yes |
| 2 | high | 251.28 → 34.53 | 12.238 → 14.429 | Yes |
| 3 | low | 242.80 → 42.23 | 6.612 → 16.876 | Yes |
| 3 | high | 242.13 → 170.62 | 8.226 → 17.699 | Yes |

[Baseline](baseline.json), [validation summary](validation.json). Reproduce: `S89_OUT=/private/tmp/s89-cadence.json node --import tsx/esm tools/qa/s89-l10gap.ts`. The gate intentionally remains red for `3/high:GAP_OVER_45`. Full retained-source receipt: `/private/tmp/s89-draft-native.json`.

Measured resident infected peaks are 60–70, below E18 ceilings of 100 LOW / 200 HIGH, with zero observed cap violations. Entity/corpse census at 1 Hz records peaks of 140–162 resident entities and 1–9 corpses. These counts do not establish renderer frame-time performance.

## Open: HIGH seed 3

The longest gap is **1059.17–1229.78 s = 170.62 s**, outside hangar dialogue; another gap is 99.25 s. The run completes with six deaths and 17.699 starts/min against an 8.226/min baseline.

Cause hypothesis: a journey death/checkpoint restore leaves the persistent Mega far behind when the cure is installed. The retained-source trace records a death at 436.02 s; around installation at 941 s the Mega is approximately 1,615 m away. It is still around 862 m away at 1080 s and 168 m at 1200 s. Journey arrivals have stopped after installation, while finale pressure does not sustain cadence during the long boss approach. This overlaps the failing interval; it is a hypothesis requiring further investigation, not a proven complete diagnosis. Trace: `/private/tmp/s89-health-trace.json`.

Rejected source/bot trials are reverted. [Rejected candidate artifacts](rejected-candidate.json) preserve earlier feasibility producers and patches; their passing rows cannot be combined into a full pass. No further experiments were performed after the final time-box instruction.

## Checks

- Fresh final typecheck and lint pass. L10 audit: zero gameplay flags in 57.3 s; exit 1 is solely its standard `PARTIAL_LEVEL_SELECTION` diagnostic flag. See validation.json.
- Full threat audit on retained gameplay: 477.6 s. No new flags; top-level failures remain the two pre-existing L4-06 issues. The existing L10 first-assault-attack-over-20-seconds warning cleared; other flag fields match baseline.
- Remote `sh tools/remote/run.sh "$PWD" -- npm test`: 106 passed, one skipped, 27 files, 203.1/240 s on 46.225.66.90.

## Browser QA needed

Human QA should inspect arrival continuity, visible pop-in/occlusion, sustained action, corpse persistence and LOW/HIGH frame time under the increased resident budgets. No browser was run; no visual or renderer-performance pass is claimed. No deployment, push or main-branch movement occurred.
