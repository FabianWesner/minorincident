# Lane r2-l4l5

The two requested admission/formation defects are fixed. The lane is **not fully green**: the required zero-flag threat gate remains unresolved by the scoped fixes. Compound L5-08 also retains its separate G-13 pace failure.

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

## L5-08 requested formation tolerance — fixed

Wide side slots steer into street cover; the resulting route corrections and crowd separation leave bodies behind after turns. Rear targets also needed more margin from the 5 m boundary. The final formation uses front/rear depths **2.5 / 3.2 m** and side offsets **±0.9 / ±0.45 m**, with staggered rear columns. The original **1.05× catch-up ceiling** and **3.8 m/s combat pace** remain unchanged.

Focused traces and full native acceptance reproduce the same seed-1 measurements:

| Follower | Low in band | Low longest outside | High in band | High longest outside |
|---|---:|---:|---:|---:|
| 31 | 100% | 0 ticks | 96.97% | 34 ticks |
| 30 | 98.57% | 29 ticks | 98.00% | 22 ticks |
| 32 | 97.52% | 31 ticks | 100% | 0 ticks |
| 28 | 95.56% | 50 ticks | 100% | 0 ticks |
| 29 | 100% | 0 ticks | 100% | 0 ticks |

Every follower has at least 691 qualifying ticks on low / 494 on high. Every share exceeds 95%; the longest excursions are 0.83 s low / 0.57 s high, below 2 seconds. These results qualify the requested band defect, not every clause of the compound L5-08 row. The engine fixture now places followers at the new authored slots; its steady-pace and 1.05× cap assertions are unchanged.

An earlier passing experiment raised catch-up to 1.5× and increased defensive reposition speeds. The completion audit rejected it as incompatible with L5-08. Those changes are absent. Routing, steering and shared-combat experiments that did not consistently pass were also discarded.

## Remaining failures — not fixed

- **L5-05:** latest low-tier skilled route attack rate **2.08/min** against 3/min; bounded-path reachability **85.71%** against 90%.
- **L5-08 / G-13:** follower 28 still falls below 95% of its phase group median in multiple seeds. Low ratios: **92.17%, 96.33%, 89.89%**; high: **92.31%, 92.81%, 94.97%**. The formation tolerance passes, but the whole compound row remains open.
- A low-tier search trace at tick 8190 shows follower 28 requesting 4.72 m/s but resolving to 3.10 m/s, with neighboring followers 0.71, 0.87 and 0.72 m away. Residual crowd/turn steering remains a cause of the separate pace failure.
- These remaining failures are retained rather than changing targets, speed ceilings, observer thresholds or eligibility rules.

## Final validation

- L5 `qa:accept --level L5 --tier both --skip-browser`: exit 1, **2 fresh failing rows / 9 incomplete rows**. Both formation-tolerance checks pass. Both complete routes finish; stationary controls reach tick budget. Both fixtures have 10 clauses / 0 errors; all 12 checkpoint clauses pass.
- `npm run test:unit`: **107 tests / 27 files passed**, four workers.
- `npm run verify -- E22`: passed typecheck, lint and **107 tests / 27 files**, with Vitest capped at 4 workers.
- `npm run verify -- E23`: passed typecheck, lint and **107 tests / 27 files**, with Vitest capped at 4 workers.
- Final L4 `qa:accept --level L4 --tier both --skip-browser`: **0 fresh failing rows / 14 incomplete rows**. Both complete routes finish; stationary controls reach tick budget. Both fixtures have 10 clauses / 0 errors; all 12 checkpoint clauses pass.
- Final standalone `npm run qa:threat`: exit 1, **3 flags** (276.3 seconds). The **zero-flag requirement is not met**: `L5/step/look:SKILLED_BELOW_ATTACKS_PER_MINUTE_3`, `L5/step/look:SLOW_FOLLOWER:28`, and `L5/phase/search:SLOW_FOLLOWER:28`.

Final runtime source digest: `52e33a922e7bda962f711280d1d6b950ba5c9cc3f20db5c4f855e8483364cb98`.

Commits: `fa1bcc1` initial slot centering; `e134902` L4 capacity reclamation; `b0996f2` final L5 formation; `f111973` steady-slot test fixture; `6d9066e` pending-conversion accounting correction. No specifications, protected references, captures, acceptance targets or thresholds were edited. No deploy or push.
