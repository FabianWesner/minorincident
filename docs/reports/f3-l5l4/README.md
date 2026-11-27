# L4/L5 combat and follower lane report

Run date: 2026-11-27. Acceptance used `--skip-browser`; source and evaluator thresholds were unchanged. The trial receipts below were captured with a 1.2x follower cap after restoring unsuccessful placement experiments. The fixed L5-08 criterion permits only 1.05x, so that trial was reverted; the final game source is the baseline. The generated `fix51-verify` reports were restored after extracting these results.

## Acceptance rows

| Criterion | Baseline (restored final) | 1.2x trial | Trial result |
|---|---:|---:|---|
| L4-07 low bounded reachability | 66.0% | 66.2% | Fail, target 90% |
| L4-07 high bounded reachability | 70.0% | 69.8% | Fail, target 90% |
| L5-05 low complete windups/min | 4.30 | 1.57 | Fail, target 3/min |
| L5-05 high complete windups/min | 2.26 | 3.44 | Pass, target 3/min |
| L5-05 low stationary | 0 windups / 228.35 s; no first attack | 0 / 228.35 s; no first attack | Fail |
| L5-05 high stationary | 0 windups / 228.35 s; no first attack | 0 / 228.35 s; no first attack | Fail |
| L5-05 low complete reachability | 84.6% | 92.3% | Pass, target 90% |
| L5-05 high complete reachability | 91.7% | 100% | Pass, target 90% |
| L5-08 low survivor 31 calm straight band | 1548/1690 (91.6%) | 1504/1568 (95.9%) | Pass, target 95% |
| L5-08 high follower pace vs group | IDs 28 below 0.95 in 2/3 seeds; ID 29 metro below in 2/3 | IDs 28 and 32 below 0.95 in 2/3 seeds | Fail |

High L5 straight-band samples also remain marginal: follower 31 was 1210/1274 (95.0% rounded; exact 94.98%) and follower 28 was 505/538 (93.9%).

## Cause and experiments

L5's intended opening attackers were silently rejected by `inFirstRescueQuiet`: it protects a 9 m corridor from the cellar exit to Mia. Two nearby trial locations stayed inside that corridor and produced no attacks. A third location outside the corridor spawned on disconnected ground, dropping the bounded reachability measure to 0%. That bad spawn was reverted. The follower catch-up trial increased the cap from 1.05x to 1.2x. It improved low straight-walk spacing, low/high reachability, and high complete attack rate, while worsening low complete attack rate and leaving the high G-13 pace vote below target. The fixed L5-08 criterion caps catch-up at 1.05x, so the trial was reverted. The original authored infected placement remains in place.

L4 blocked samples persist around the north interior defense/reception area. At the high-tier worst sample, the courier was at about (-7.75, -14.43), while blocked infected were clustered around x=-15..-24, z=-12..8. Three layout variants were tested and reverted: widening the north gap reduced reachability to 64.3%; moving the central light tower produced 61.8%; an east-side gap produced 66.7% and caused the route to end `mission-failed`. The original layout is restored. The exact remaining choke within the reception/inner-line geometry is unresolved; no actors were removed from the census.

## Threat audit and validation

The 1.2x trial `threat-audit --levels L4,L5` reported zero L4 level flags and five L5 flags: skilled L5 attacks below 3/min, plus slow followers 28 and 32 in `step/look` and `phase/search`. `PARTIAL_LEVEL_SELECTION` is the expected diagnostic notice. `npm run typecheck` and `npm run lint` passed. The first focused NPC test run failed because its expected speed still encoded 1.05x; I updated those two existing assertions and `npm run test:unit -- tests/engine/npcs.test.ts` then passed (3/3 tests).

## Files changed

- `docs/reports/f3-l5l4/README.md`

No game change was retained; the source is restored to the baseline. L4 and L5 current acceptance receipts are reproducible with the lane's four `qa:accept` commands; they were not kept under `docs/reports/fix51-verify` because that directory is a shared generated report set.

## Open

L4-07 still needs an accessible route through the north interior line/reception footprint. L5-05 needs an attack placement outside the first-rescue corridor and on connected road cells; the current attack-pressure regression at low tier is open. L5 G-13 needs a way to bring followers 28 and 32 up to group pace without causing other followers to leave their measured band. This lane did not meet the full acceptance goal.
