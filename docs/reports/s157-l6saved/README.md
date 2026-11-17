# s157 — L6 native survivor retention

## Result

The requested native gate already passes on PROD batch 116 (`ea21b122`). Across skilled HIGH+LOW seeds 1–3, survivors out average **73.6%**, the minimum is **69.0%**, and player deaths are **0**. The matched normal-walk comparison averages **67.8%**, bottoms at **58.6%**, and has at most **3** player deaths.

All 12 candidate rows exactly match the pre-s148 baseline: saved counts, deaths, completion times, and survivor loss positions. No gameplay change was justified. The candidate’s HIGH/LOW differences are also zero in this native matrix. No zombie stats, survivor health/invulnerability, wave population, or corpse persistence changed.

## Before / after by tier, policy, and seed

The denominator is 29 survivors in each run.

| Tier | Policy | Seed | Baseline saved | Candidate saved | Baseline deaths | Candidate deaths |
|---|---|---:|---:|---:|---:|---:|
| HIGH | Skilled | 1 | 20/29 | 20/29 | 0 | 0 |
| HIGH | Skilled | 2 | 21/29 | 21/29 | 0 | 0 |
| HIGH | Skilled | 3 | 23/29 | 23/29 | 0 | 0 |
| HIGH | Walk | 1 | 21/29 | 21/29 | 3 | 3 |
| HIGH | Walk | 2 | 17/29 | 17/29 | 0 | 0 |
| HIGH | Walk | 3 | 21/29 | 21/29 | 1 | 1 |
| LOW | Skilled | 1 | 20/29 | 20/29 | 0 | 0 |
| LOW | Skilled | 2 | 21/29 | 21/29 | 0 | 0 |
| LOW | Skilled | 3 | 23/29 | 23/29 | 0 | 0 |
| LOW | Walk | 1 | 21/29 | 21/29 | 3 | 3 |
| LOW | Walk | 2 | 17/29 | 17/29 | 0 | 0 |
| LOW | Walk | 3 | 21/29 | 21/29 | 1 | 1 |

| Tier / policy | Baseline avg saved | Candidate avg saved | Candidate min | Candidate max deaths |
|---|---:|---:|---:|---:|
| HIGH skilled | 73.6% | 73.6% | 69.0% | 0 |
| LOW skilled | 73.6% | 73.6% | 69.0% | 0 |
| HIGH walk | 67.8% | 67.8% | 58.6% | 3 |
| LOW walk | 67.8% | 67.8% | 58.6% | 3 |

Full per-run receipts and loss context are in [native-results.json](native-results.json) (102 KB, below the 200 KB limit). It records survivor IDs/statuses, tick, phase, victim and infected positions, infected ID/archetype, courier and leader positions, stationary duration, and gate states.

## Loss attribution

Every lost survivor in the native matrix is associated with an `infected.runner` grab/turn receipt. Turn receipts use the simulator’s `civilian.turned.infectedId`. For a survivor whose final status is turned but whose run emitted only a `civilian.finished` event, the receipt names the last captured infected grab and marks that attribution as inferred. Downed deaths also use the last captured infected grab; the L6 mission does not emit a separate final-damage source event.

The loss snapshots show no closed gate between a victim and courier, and no survivor had been stationary for five seconds before the recorded loss. Most losses occur while the courier is at or behind the attacked group during breach/retreat pressure. The repeatable exception is Mia on skilled seed 3: she is 11.91 m behind the courier at x=141.48 during retreat and is attacked by a runner; the x=150 gate is open, and she had moved within the previous 2.02 seconds. This loss is identical on baseline and candidate, and does not cross the save or death thresholds.

The baseline source is `572009e4^` (`c02a9b91`). The sandbox denied a linked Git worktree because the shared `.git/worktrees` directory is read-only, so the baseline was run from an exact source archive under `/private/tmp`. Its `LevelSixSubway.ts` SHA-256 matched `git show 572009e4^:src/sim/missions/LevelSixSubway.ts`. No baseline source was edited.

## Threat and validation

No gameplay or infected-stat files changed in this lane. Validation:

- `npm run qa:threat` — passed in 339.9 s; **0 fail flags**, 150/150 inventory, below the 600 s cap.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `sh tools/remote/run.sh "$PWD" -- npm test` — passed on runner `46.225.66.90`: 27 files, 105 passed / 1 platform skip, 150/150 inventory, 185.0 s within 240 s. This supersedes the initial unavailable-runner result.
- Native matrix: `node --import tsx tools/qa/s157-l6saved.mts` — 12/12 complete for each build; zero failed or stalled runs.

## Browser QA needed

No browser was used in this lane. QA should use L6 on real input at **HIGH and LOW**, seeds **1–3**, and inspect:

- **Tick 2,000–3,500:** shelter breaches and the first tunnel movement. Confirm infected reach the survivor group, the group remains visible, and nearby bites are readable.
- **Tick 8,800–10,000:** the seed-3 retreat around x=140–155. Check whether a survivor about 12 m behind the courier catches up, whether an infected reaches them, and whether the open x=150 gate remains passable.
- **Tick 11,000–12,000 / Northgate exit:** check survivors visibly cross into the night street, the result count matches the group, and no one remains behind a closed gate. Confirm injured followers keep walking without manual babysitting.

Record tier, seed, tick, survivor count, player deaths, and any manual corrections so the QA lane can compare the reported 1/29 real-input exit with this native baseline.
