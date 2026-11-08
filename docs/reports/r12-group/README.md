# R12 natural group movement

**Status: authorized L7 fallback implemented; final runtime `6fc09518` is under native validation.**

## Done

- Merged current main `eb835fc1` as `b3382b53`.
- Gated R12 movement off for **L7 only** (`88b8e6b3`): entry/pickup/formation targets, steering response, braking, start delays and idle bookkeeping match main. R13's distinct bus queues, collision handling and boarding recovery remain.
- Retained natural movement elsewhere: loose slots, independent sway, staggered starts and idle glances. L5 keeps its authored bounded tracking; L8 retains distant catch-up/boarding and nearby courier pacing.
- `6fc09518` applies L5 slot wander before the bounded velocity calculation and preserves L6's authored convoy response. These avoid adding steering after mission controllers have solved their movement.

## L7 fallback verification

Every tested native final hash **and follower phase receipt** matches clean `eb835fc1` ([low comparison](d-gate-equivalence.json), [high comparison](d-gate-high-equivalence.json)).

| Quality / seed | Lane and main outcome | Time | Matching final native hash |
| --- | --- | ---: | --- |
| low / 1 | complete | 116.37 s | `7531f27e` |
| low / 2 | mission-failed | 74.78 s | `02602b10` |
| low / 3 | complete | 120.12 s | `66622d3c` |
| high / 1 | mission-failed | 105.32 s | `f303c8ff` |
| high / 2 | mission-failed | 64.52 s | `470e45ff` |
| high / 3 | mission-failed | 101.13 s | `e2128f94` |

Current main therefore does **not** complete all three seeds. The fallback removes the lane's additional L7 failure and restores main's behavior; it does not claim to fix main's existing courier deaths.

The earlier bus-destruction diagnosis was incorrect: `tools/sim-runner/levels.ts` records the **courier's** HP in blocker `hp`. [Corrected trace summary](l7-route-blocker.json). Rejected restrictions and historical source comparisons are retained in [investigation history](investigation-history.md) and [trial receipts](d-trials.json).

## Native checks

The final `6fc09518` snapshot passes typecheck, lint and **107 tests / 27 files** ([receipt](d-velocity-checks.json)). Its quiet boarding fixtures pass both tiers: L7 **24/24 in 8.18 s**, L8 **13/13 in 21.38 s**, zero collision invariant failures, no assists/recoveries, courier last in L7 ([receipts](d-velocity-boarding.json)).

Its six-level audit completed in 410.6 s; clean main completed in 504.2 s. [Comparison before the velocity correction](d-follower-comparison-before-l5.json): L7 is identical; L8 removes main's slow-follower IDs 354/359/365; L5's new ID-28 pace vote is the reason for the final correction. Both snapshots retain diagnostic partial-selection and baseline flags. Neither is a passing complete threat gate.

The final `6fc09518` unit gates and boarding fixtures pass. Its six-level audit and refreshed motion receipts are pending. The evaluator, seed validity and thresholds are unchanged.

## Done / open handoff

- **Done:** main integration, authorized L7 fallback, native low/high parity over all three seeds, and corrective velocity handling.
- **Open:** final `6fc09518` audit/motion receipts; current-main L7 courier deaths and known pace/wait/coverage flags.
- **Browser QA needed.** No browser was used.
- No push or deployment.
