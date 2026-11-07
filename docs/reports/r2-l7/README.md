# r2-l7: L7 opening pressure and departure pace

Base: `daada5d`. Source fixes: `e8fd23c` (L7-05), `2287dbd` (G-13). No deployment or push.

## L7-05 — fixed

Baseline high stationary first player attack was **10.37 s** (low: 1.3 s). A nearby survivor sighting discarded the infected's opening courier pressure focus. Preserving that focus and assigning one close high-tier runner to the opening press fixes the targeting cause without moving the courier or spawns.

Final both-tier acceptance: high first player attack **9.3 s**, low **1.3 s**, both within the 10 s limit. First group attacks: high 1.55 s / low 2.75 s. Minimum bounded-path reachable share: 100% at both tiers. Every current L7-05 automated clause passes.

## G-13 high departure pace — fixed

The affected evacuees were healthy. A turning courier swung the three-column tail across the parked bus; invalid slots also fell back to the same courier position. Followers collided and repeatedly changed route around the obstruction. High-tier followers now retain distinct clear targets. During departure, two columns follow the courier's actual walked path through the corner. The bounded path history is saved with checkpoints. Low retains its original formation behavior.

All complete routes finished for seeds 1–3 at both tiers. Every measured departure follower clears 0.95 of group median in **each** seed, stronger than the two-of-three vote required by the audit.

| Tier | Seed 1 minimum ratio | Seed 2 minimum ratio | Seed 3 minimum ratio |
| --- | ---: | ---: | ---: |
| High | 0.959852 | 0.950082 | 0.960095 |
| Low | 0.978290 | 0.973318 | 0.978223 |

High departure ID 51 ratios are 1.000–1.005; ID 69 ratios are 0.962–1.000, versus the brief's 0.93 / 0.85. High group medians are 4.600 / 4.577 / 4.535 m/s. Both automated G-13 clauses (pace and stationary far-follower upper bound) pass at both tiers; the aggregate historical/manual status is not automatically closed by the runner.

## Final validation

- `npm run typecheck` and `npm run lint`: passed.
- `npm run verify -- E29`: passed; typecheck, lint, and 107 engine/shared tests across 27 files (the `test:unit` suite).
- `npm run qa:accept -- --level L7 --tier both --skip-browser`: completed, exit 1; **1 fresh failing row / 8 incomplete rows**. The fresh failure is the unrelated G-24 healthy distant Alpha health-bar fixture. Historical L7-01 physical pickup/frame findings remain outside this brief; browser clauses were skipped as requested. Both complete policies finished; all six checkpoint replays passed with identical control state. Stationary policies reached their simulation tick cap after measuring the opening window.
- `npm run qa:threat`: ran alone last, **passed with zero fail flags** across L1–L10 in 303.8 s (306.5 s including wrapper). L7 skilled/passive routes completed; both pace audits over seeds 1–3 have zero flags.

[Retained numeric receipts](results.json) include source/observer hashes, all per-follower departure medians, sample counts and ratios, verification results, and the final threat summary. Generated global acceptance files were restored after extracting these receipts.
