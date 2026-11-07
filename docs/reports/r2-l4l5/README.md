# Lane r2-l4l5

**L4-13 is fixed. L5-08 is not fixed. The full goal is not achieved.** The formation candidate passed the band tolerance but introduced threat/pace regressions. A fresh baseline control proved those failures were introduced by the candidate; all L5 source and fixture changes were therefore reverted in `789eeb7`. The earlier report's scoped-success claim is superseded by this result.

## L4-13 collapse admissions — fixed

At the failed collapse window the infected population was at its cap. Ordinary idle infections far outside the camera were retained as `collapseIds`; valid collapse mouths were available, but admission capacity was not.

`LevelFourWar` now reclaims capacity from distant, ordinary, idle infections for the newly announced collapse cohort, once per wave. Scripted, engaged, attacking, recovering, Alpha and breach actors remain protected. Caps and admission requirements are unchanged.

The final complete native probe (seed 1) records every announced collapse window:

| Tier | Complete route | Director peak | Announced windows | Minimum admissions/window |
|---|---:|---:|---:|---:|
| Low | 349.83 s | 80 | 13 | 4 |
| High | 320.75 s | 120 | 10 | 3 |

Twelve low / nine high windows have full 9-second observation. Each final window ends early on cellar entry but has already admitted six low / four high bodies. Every announced window therefore meets the three-admission minimum. The formerly failing low window at ticks 14689–15229 now admits seven bodies. Final state hashes match the canonical acceptance routes: low `3f51b7ce`, high `15b5833c`.

The completion audit also corrected double-counting of pending conversions in the reclaim loop. A controlled capacity case with 78 living infected, two pending conversions and cap 80 now retires exactly three bodies for three admissions; before correction it retired five. Calling the method again in the same wave retires no additional bodies.

## L5-08 — not fixed; candidate reverted

The candidate used 2.5 / 3.2 m depths and ±0.9 / ±0.45 m side offsets while preserving the 1.05× catch-up ceiling and 3.8 m/s combat pace. It improved seed-1 in-band minima to **95.56% low / 96.97% high**, with maximum excursions **0.83 / 0.57 seconds**. However, its skilled attack rate fell to **2.08/min** against 3/min, and follower 28 failed the pace comparison in multiple seeds. Passing the band alone did not make it an acceptable fix.

### Fresh baseline control

A read-only Node module-load override supplied `src/sim/outbreak/Survivors.ts` exactly from `7d2c9af` (Git blob `82c884a598d0f4aa0ab84b00466dc9c4678418fe`). This is the sole L5 runtime file changed by the lane; the other runtime changes are L4-only. The override was asserted to execute. Three low-tier complete routes used the unchanged native observer and thresholds:

| Seed | Baseline skilled attacks/min |
|---|---:|
| 1 | 4.38 |
| 2 | 5.47 |
| 3 | 5.27 |

The baseline has **no follower-pace flags** across those seeds. Follower 28's step/look median/group ratios are **101.63%, 99.36%, 97.66%**. This contradicts treating the candidate's attack-rate and pace failures as unrelated or pre-existing.

The baseline still reproduces the assigned band bug. Seed-1 low shares for followers 31, 30, 32, 28, 29 are **97.68%, 96.08%, 99.51%, 74.49%, 100%**, with a maximum outside run of 75 ticks (1.25 s). L5 needs a controller/spacing fix that improves the band without regressing pressure and pace. The candidate and unsuccessful speed, routing, steering and shared-combat experiments are absent from the final source.

Local control evidence: `test-results/r2-l4l5/baseline-control.json` and `.log`. The final diff contains **no L5 gameplay or test-fixture changes** relative to `7d2c9af`.

## Validation and remaining work

- L4 full native admission probe: both routes complete; all announced windows meet three admissions; canonical final state hashes match. The L4 source files are unchanged since these measurements.
- L4 `qa:accept --level L4 --tier both --skip-browser`: **0 fresh failing rows / 14 incomplete rows**. Both complete routes finish; stationary controls reach tick budget. Both fixtures have 10 clauses / 0 errors; all 12 checkpoint clauses pass.
- Before L5 candidate removal, `npm run verify -- E22` and `-- E23` passed typecheck, lint and **107 tests / 27 files**, with four Vitest workers.
- **After the L5 reversion**, `npm run test:unit` passes **107 tests / 27 files**, four workers.
- The last full L5 acceptance and standalone threat audit apply to the **rejected candidate**: acceptance exited 1 (2 fresh failing rows / 9 incomplete rows); threat exited 1 with three L5 attack-rate/pace flags. They do not qualify the reverted final source.
- Final-source L5 acceptance and standalone zero-flag threat qualification remain required. The baseline control is not a substitute for those full commands. The original 2.5-hour timebox ends at **09:54 UTC**; completing L5 and repeating its gates requires an extension.

Retained fix commits: `e134902` L4 reclamation; `6d9066e` pending-conversion accounting. Rejected L5 candidate commits remain in history (`fa1bcc1`, `b0996f2`, `f111973`) and are undone by `789eeb7`. No specifications, protected references, captures, acceptance targets, observer eligibility rules or speed ceilings were changed. No deploy or push.
