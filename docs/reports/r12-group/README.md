# R12 natural group movement

**Status: authorized L7 fallback completed and natively verified. Final runtime: `6fc09518`; no added follower failures versus merged main `eb835fc1`. Browser QA remains open.**

## Done

- Merged current main `eb835fc1` as `b3382b53`.
- Gated R12 movement off for **L7 only** (`88b8e6b3`): entry/pickup/formation targets, steering response, braking, start delays and idle bookkeeping match main. R13's distinct bus queues, collision handling and boarding recovery remain.
- Retained natural movement elsewhere: loose slots, independent sway, staggered starts and idle glances. L5 keeps its authored bounded tracking; L8 retains distant catch-up/boarding and nearby courier pacing.
- `6fc09518` applies L5 slot wander before the bounded velocity calculation and preserves L6's authored convoy response. These avoid adding steering after mission controllers have solved their movement.

## L7 fallback verification

Every tested native final hash **and follower phase receipt** matches clean `eb835fc1` ([low comparison](d-velocity-L7-low-equivalence.json), [high comparison](d-velocity-L7-high-equivalence.json)).

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

The final six-level remote audit covers **L2, L3 police, L5, L6, L7 and L8** using the unchanged evaluator, policies, seeds and thresholds. It completed in **463.0 s** versus current main's **504.2 s**. [Complete follower comparison](d-follower-comparison-final.json), [completion audit](d-completion-audit.json). The wrapper used 1200 s of observational wall allowance; no checked-in budget or gameplay criterion changed.

- **No added follower flags** in skilled/passive raw phases or aggregate flags. No added qualified seed failures in L5/L7.
- L7's full native receipt is identical to main, including its known wait/slow/unobserved coverage flags. L2/L3 native state hashes are also identical.
- L5 has **zero skilled or passive pace-vote flags**; its temporary ID-28 regression is removed.
- L6 has no slow-follower flags; stationary-far time falls **179.62 → 135.13 s**, and its upper-bound share falls **52.96% → 45.54%**.
- L8 removes main's slow-follower flags for **354/359/365**; skilled stationary-far share falls **1.74% → 0.53%**.
- Every skilled/passive route reports **zero collision invariant failures**.

The audit still exits 1: seven flags remain versus main's ten. They are the unchanged L7 wait/pace/coverage flags, L8's late first attack, and diagnostic `PARTIAL_LEVEL_SELECTION`. This is **not a passing complete threat gate**, and unqualified samples were not counted as passes. [Final remote source fingerprint](d-velocity-remote-runtime.json), [main fingerprint](d-remote-main-runtime.json) confirm matching evaluator code and the actual runtime sources.

The preceding integration comparison and rejected restrictions are archived in [investigation history](investigation-history.md).

## Native motion and roster measurements

[Final-source motion receipts](d-velocity-native-metrics.json), [current-main comparison receipts](d-main-native-metrics.json). NN CV measures nearest-neighbor spacing variety. Facing R is direction concentration (1 means identical facing). Rails measures two-second lateral windows under 10 cm. These are descriptive measurements, not invented acceptance thresholds. L2 samples six scripted firefighters; L3 samples four police; other rows sample human followers.

| Level / tier | Outcome / seconds | NN CV | Moving facing R | Rails main → lane |
| --- | --- | ---: | ---: | --- |
| L2 / low | complete / 148.3 | 0.558 | 0.607 | — |
| L2 / high | complete / 155.9 | 0.550 | 0.775 | — |
| L3 / low | complete / 193.4 | 0.169 | 0.948 | 20.9% |
| L3 / high | complete / 351.9 | 0.366 | 0.929 | 7.7% |
| L5 / low | complete / 228.3 | 0.193 | 0.944 | 14.7% → 15.4% |
| L5 / high | complete / 258.0 | 0.139 | 0.956 | 25.7% → 22.2% |
| L6 / low | complete / 296.7 | 0.237 | 0.987 | 51.7% → 9.3% |
| L6 / high | complete / 296.7 | 0.237 | 0.987 | 51.7% → 9.3% |
| L8 / low | complete / 194.5 | 0.253 | 0.917 | 39.2% → 6.0% |
| L8 / high | tick-budget / 247.6 | 0.225 | 0.940 | 43.7% → 6.4% |

L8 high reaches its native route budget on both snapshots. L5 low's rail share is slightly higher; its moving facing concentration is lower. The measurements do not claim every metric improved.

The final L6 run rescues **22/29 (75.9%)** in **296.7 s**, versus main's 24/29 in 339.2 s. All remaining living followers exit; seven turn versus main's five ([roster comparison](d-velocity-L6-roster-comparison.json)). This meets E24-AC02's 3–5 minute / ≥60% exit thresholds, while retaining the casualty difference explicitly. The earlier 70% reference concerned straggler rejoining, not the overall rescue threshold. The final L6 diagnostic has no slow rows and a 45.5% stationary-far upper bound versus main's 53.0%; this is not a causal wait measurement or an all-criteria pass.

## Done / open handoff

- **Done:** main integration; authorized L7 fallback; final-source low/high parity over all three seeds; corrective L5/L6 velocity handling; typecheck/lint/107 unit tests; native boarding, motion and six-level comparison.
- **Open:** current-main L7 courier deaths and known pace/wait/coverage flags; L8 late first attack and high-tier native-route limit. No claim that all three L7 seeds complete or that the complete release gate is green.
- **Browser QA needed.** No browser was used.
- No push or deployment.
