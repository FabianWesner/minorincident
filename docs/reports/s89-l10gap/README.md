# s89-l10gap

Status: incomplete. No gameplay change has been made.

Fresh native baseline at 023991a5. All six runs completed. Dialogue ticks are subtracted from each adjacent attack-start gap. Rate uses first attack to final simulation tick, matching the s86 harness.

| Seed | Tier | Starts | Starts/min | Longest adjusted gap (s) | Dialogue (s) | After |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | low | 35 | 1.896 | 295.05 | 56.02 | Pending |
| 1 | high | 127 | 6.520 | 356.15 | 56.02 | Pending |
| 2 | low | 63 | 3.376 | 298.70 | 56.02 | Pending |
| 2 | high | 240 | 12.238 | 251.28 | 56.02 | Pending |
| 3 | low | 127 | 6.612 | 242.80 | 56.02 | Pending |
| 3 | high | 163 | 8.226 | 242.13 | 56.02 | Pending |

Receipt: [baseline.json](baseline.json). Reproduce with `S89_OUT=/private/tmp/s89-cadence.json node --import tsx/esm tools/qa/s89-l10gap.ts`. Observer uses native complete inputs and the unchanged attack-start observer. This corrects the initial report, whose denominator mistakenly used gameplay time excluding credits.

Seed-1 traces show living actors in chase/search tens to hundreds of metres behind the running courier, with only 0–3 within 30 m during long outdoor gaps. They converge during the protected hangar stop. Several authored archetypes run slower than the courier, so retaining their chase state does not ensure renewed contact. This supports a pursuit/contact diagnosis but does not yet prove a successful remedy.

The fresh seed-1 baseline differs from the s86 reported count. The current receipt is authoritative for these runs; the discrepancy remains to be explained before claiming a rate improvement.

Outstanding: root-cause fix, hangar-adjusted whole-run gap measurement, after matrix, L10 audit with zero flags, full audit with no new flags, typecheck, lint, remote units, and focused commit. No stats, caps, corpses, QA thresholds or protected reference files changed.

## Browser QA needed

Human QA must inspect visible arrival continuity and sustained combat after a successful native fix. No browser was run and no visual fix is claimed.

Measurement tooling validation: `npm run typecheck` and `npm run lint` pass. Mega cruise is 5.4 m/s before progression scaling, so its persistent trailing distance still needs steering/state evidence; slower regular archetypes alone do not explain that actor.

## Mega diagnostic, seed 1 LOW

A native observation through 300 simulation seconds found the Mega in detailed/close pursuit, configured cruise 5.4 m/s. Between ticks 12000 and 18001 it was staggered for 377 of 6002 sampled ticks (6.28%); the same 377 ticks were under special recovery. Thus the theoretical 25% interruption calculation does not describe this run and is insufficient as the root cause. No hit response was changed. Sampled distance over seconds 200–300 ranged from 10.80 to 31.03 m. Next diagnostic: distinguish navigation detours, special scheduling and non-courier proximity-notice pauses before selecting a fix. Temporary full diagnostic: `/private/tmp/s89mega-counter.json`.
