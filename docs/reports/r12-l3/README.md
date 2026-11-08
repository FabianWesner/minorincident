# r12-l3: L3 pressure reduction, cancelled by the PO (2026-11-08)

The PO later said: "ah, don't change this police level in terms of nr of Zomies. I died one time but then was able to handle it." The lane stopped there. **No game code, data or acceptance criteria were changed.** This lane commits only a measurement probe and the baseline it measured, for any later lane.

## Probe

`node --import tsx/esm tools/qa/r12-l3-pressure.ts --tier low|high [--seeds 1,2,3]` runs the ordinary mortal `complete` bot, using the same runner as qa:threat L3-06. Each run takes about 17 s. It reports the following for each phase (yard, S1, S2, S3, army approach):
- infected within 10 m of the courier: max, p90 and mean
- police-look share
- attack starts on the courier per minute
- damage and deaths
- seconds spent in the phase
- squad size at the army line

## Baseline (main `ab602666`), seeds 1–3

| Tier/seed | Deaths | Damage | Squad at army | Worst phase (max ≤10 m, attacks/min) |
|---|---|---|---|---|
| low 1 | 1 | 124 | 4 | S1: 29, 71.5/min |
| low 2 | 0 | 44 | 4 | yard: 12, 16.4/min |
| low 3 | 0 | 110 | 0 | army approach: 17, 35/min |
| high 1 | 4 | 667 | 0 | S3/army: 22–23, 62–78/min (400 s run) |
| high 2 | 0 | 44 | 4 | yard: 16, 6.1/min |
| high 3 | 0 | 22 | 4 | yard: 14, 7.6/min |

Exact values are in [baseline.json](baseline.json). The pattern matches r6-l3's finding: the outcome splits in two. If the squad lives, the courier sees ≤ 6 infected within 10 m after the yard. If it dies, 17–29 press her at once.

## Leads for a future lane (not acted on)

The bot keeps advancing, so it never triggers two sources that a careful human player would:
- **Forward pressure** (`l3.density.pressure`): 25–75 infected per 10 s from 15–35 m behind once the courier has spent 20 s behind her furthest line, for example while backing off and shooting.
- **Shot-triggered spills** (30/45 per link).

The PO screenshot shows a blob of about 40 infected coming from behind the courier, with no officers in view. That fits either source. A "careful" policy (back off and shoot) would be needed to measure them.
