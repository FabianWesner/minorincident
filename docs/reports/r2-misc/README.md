# r2-misc

Base: `bf5e35e`. Four fixes, one commit each. Acceptance targets and the 30/60 L2 concurrency caps are unchanged. No deploy or push.

| Item | Result | Cause and measured result | Commit |
|---|---|---|---|
| L1-08 | Fixed | Frozen `4e570db` reproduces **88.8889%**, 8/9 reachable at tick 5252. Infected **166** is at `(17.10346, 34.09321)`, beside **prop.street-sign:1257**, authored at `(17.5, 33.5)` on the garage approach. Its post collider is centred at `(17.5, 33.764)`. Moving only this sign 0.1 m west opens a **9.209 m** body-clear path in an independent copy of the same grid. The complete frozen-source run with only the sign relocation reaches a spread-phase minimum of **100%**, still finishing in **115.0833 s**. Current-source complete probes reach **100% low / 95% high** (23 spread samples each, unchanged ≥90% target). The change is confined to L1's layout copy. | `4d60482` |
| L2-11 | Fixed | The low-tier pairs became singletons, prepared formations could be recycled at their own phase transition, and the early radio could precede actual admission. Low now queues four-person formations, retains them through transition, and waits for the street population before the early call; the existing 45 s fallback remains. Four mortal route checks pass: low no-axe **29/30** in-area, **5 groups**, **6/30 chasing**; low complete **25/30**, **5 groups**, **4/30 chasing**. High no-axe **34/42**, high complete **34/46**, both **4 groups**. Every route admits **6 scattered singles**; peaks remain **30 low / 60 high**. Complete-policy bridge attacks are **14.4907/min low / 11.2983/min high**, within 2–20/min. | `b9542bf` |
| L3-13 | Fixed, reported seam | The join polygon stopped short of the tilted ramp edge and exposed its vertical fascia. The filler now overlaps the road edge and has no exposed side faces. The old seam ray at image `(950,577)` hit the side at **y≈5.677**; it now hits the top at **y=5.703**. Personally inspected all four final low/high, zoom **0.5/1.5** WebGL2 frames at the frozen position after **600 settled ticks**: the black slit is covered. A flat asphalt colour boundary remains. | `eb391bf` |
| L9-05 | Fixed | Young engine puffs started inside the closed hull and used the vehicle-sized blast reveal mask. Smoke now emits outside the rear side vent, uses a distinct column class, becomes dense promptly and has larger heavy-stage billows. Personally inspected all four final low/high, zoom **0.5/1.5** frames after about **4 s** of physical W input: dense grey smoke is visible; the driver and forward road remain visible. Low records **36 puffs / 120 cap**, high **66 / 400**, **1 vehicle column**, **0 HP**, stage **4**, speeds **10.607–10.654 m/s**. Emission rates and particle-pool limits are unchanged. | `e854f5f` |

## Evidence and scope

- [L1 frozen counterexample](L1-frozen-diagnostic.json) and [same frozen source with only the L1 sign relocation](L1-frozen-fixed.json). The source snapshot came from git; D-GROVE asset files are byte-identical between frozen and current commits. The [producer snapshot](frozen-probe.ts.txt) runs from the archive root. Read-only probes never change the live grid. JSON `null` for the original path distance represents Infinity/no legal path.
- [L2 admission matrix](L2-admission.json) and its [producer](l2-admission.ts). Cluster counts at approach are **12 low/no-axe**, **13** in the other routes, within the unchanged **12–16** criterion. The old `fix55-l2-groups.ts` assertion demands exactly 13 and fails on that 12; its stricter assertion was not changed. The six singles are admission identities along the whole walk, distinct from the number still alive at radio.
- [Capture review and image hashes](capture-review.json), [capture producer](capture.ts). Images remain exclusively under `test-results/r2-misc/L3-final/` and `L9-final/`; none are committed. L3 uses a disclosed static pose at the exact frozen position, not a route-readability or physical-traversal claim. L9 uses ordinary physical W after the disclosed production `vehicle.damage(maxHP)` fixture.
- Earlier visual trials and discarded L1/L2 experiments are not qualification evidence. The initial 0.7 m sign move reproduced a later current-source low-tier obstruction (50% minimum); it was replaced with the smaller 0.1 m move before final validation. The extra-capacity attempt was reverted before the final L2 fix.

## Validation

- `npm run verify -- E19` and `npm run verify -- E21`: **PASS**. Both run the current shared gate: typecheck, lint, **107 tests in 27 files**, at most four Vitest workers. The final E19 run includes all four fixes. See [validation.json](validation.json).
- `npm run qa:accept -- --level <L1|L2|L3|L9> --tier both --skip-browser`: native stages only; this cannot requalify every visual or physical-input clause. Results (level rows):

| Level | Exit | Fresh failing rows | Incomplete rows | Evidence |
|---|---:|---:|---:|---|
| L1 | 1 | 0 | 12 | [Native summary](L1-native.json); all 14 L1-08 clauses PASS, including complete spread reachability **100% low / 95% high**. Both checkpoint restores pass on both tiers, controls identical. |
| L2 | 1 | 0 | 10 | [Native summary](L2-native.json); all four L2-11 census checks PASS. Historical L2-12 FAIL is retained even though its current clauses PASS. |
| L3 | 1 | 2 | 10 | [Native summary](L3-native.json); L3-06 low calm following reaches 6.40/6.58 m, outside 3–6 m; L3-08 low segment medians are 22/23/22 rather than increasing. These are outside the reported seam fix. Both tiers restore all six checkpoints with identical controls and zero execution errors. L3-13 has no native visual check; the reviewed image matrix above is its evidence. |
| L9 | 1 | 0 | 8 | [Native summary](L9-native.json); historical L9-03 FAIL retained. Zero-HP mechanics and checkpoints pass; the smoke review is separate. |

The counts above exclude global rows. The L1/L3 reports also record a fresh **G-24** failure: a far, healthy Alpha still shows its bar while the global fixture expects it hidden. Historical global failures remain open. These commands therefore do not establish a full acceptance GO.

`npm run qa:threat -- --out test-results/r2-misc/threat`: **PASS, exit 0; 0 flags across all 10 levels**, **347.900 s**, two workers, run alone after the other checks at source commit `4d60482`. Every skilled route completes; passive policies retain their declared complete/tick-budget outcomes. [Threat summary](threat-summary.json); raw audit and logs remain under `test-results/r2-misc/threat/`.
