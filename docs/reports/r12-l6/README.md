# r12-l6 — rail pressure and a readable ending

**Status: implementation and native balance pass complete; browser captures and final gates pending.** Baseline: `1b4e89b1`. No deploy or push.

## Changes

- Rail pressure now dispatches three infected together, alternating between a side entry ahead of the walking tail and an entry behind it. The 40-second cohort interval was retained after faster/larger variants caused repeated deaths or retry loops.
- During the visible procession through the open Northgate gate, the HUD says **“The survivors are safe.”** The existing authored night shot and exact caption **“Night. Still alive.”** remain after the group clears the exit.
- The acceptance rows L6-07 and L6-11 now record the PO’s 2026-11-08 pressure, attack, survivor, and death targets.

## Before/after native measurements

The same complete L6 bot, seeds 1–3, both quality settings, and `ThreatObserver` measured recurring arrivals, spawn direction, attacks on the courier and survivors, survivors out/lost, deaths, and peak concurrent infected. The before run temporarily used the untouched source from baseline `1b4e89b1`; the worktree source was restored before the after runs. `high` and `low` runs are deterministic and currently share the same 30-infected observed peak; their director quality/cap settings remain distinct.

| Tier / seed | Arrivals/min before → after | Ahead / behind after | Player attacks/min before → after | Follower attacks/min before → after | Survivors out before → after | Deaths before → after | Peak infected after |
|---|---:|---:|---:|---:|---:|---:|---:|
| Low 1 | 4.70 → 4.51 | 12 / 15 | 12.48 → 18.20 | 3.64 → 7.00 | 25 → 22 | 0 → 2 | 30 |
| Low 2 | 5.10 → 4.50 | 12 / 12 | 9.37 → 11.29 | 6.04 → 7.06 | 25 → 25 | 1 → 1 | 28 |
| Low 3 | 4.92 → 4.49 | 23 / 18 | 32.17 → 15.71 | 18.05 → 5.92 | 0 → 26 | 14 → 3 | 26 |
| High 1 | 4.70 → 4.51 | 12 / 15 | 12.48 → 18.20 | 3.64 → 7.00 | 25 → 22 | 0 → 2 | 30 |
| High 2 | 5.10 → 4.50 | 12 / 12 | 9.37 → 11.29 | 6.04 → 7.06 | 25 → 25 | 1 → 1 | 28 |
| High 3 | 4.92 → 4.49 | 23 / 18 | 32.17 → 15.71 | 18.05 → 5.92 | 0 → 26 | 14 → 3 | 26 |

Seed 3 is the key robustness result: the baseline complete bot timed out after 1,200 seconds and 14 deaths; the new cohort pacing completed in 614 seconds with 26 survivors out and 3 deaths. Across all after runs, 22–26 of 29 survivors reached the exit, and both directions were represented in every run. Larger/faster cohort experiments are excluded from acceptance: 4 every 40 seconds caused 20 deaths and a timeout on seed 2; a fixed 3 every 35 seconds and a 30/40/35 cycle also caused seed-locked retry loops.

Raw source-bound measurements: [before](evidence/pressure-before.json), [low after](evidence/pressure-low-after.json), [high after](evidence/pressure-high-after.json), [combined matrix](evidence/pressure-matrix.json). The reusable measurement runner is [r12-l6-measure.ts](../../../tools/qa/r12-l6-measure.ts).

## Verification and remaining work

Native measurement used the simulation’s ordinary complete policy and no injected health, movement, objective, or input state. This is balance evidence, not real-input browser evidence. The brief still requires real-input captures opened at low/high × zoom 1/1.5, `npm run qa:accept -- --level L6 --skip-browser`, full `npm run qa:threat`, `scene:gate`, typecheck, lint, and unit tests. Record results and capture hashes here before closing the lane.
