# s211c — L10 solid props

D-CURE substantial placements now opt into baked collision and navigation geometry after L10 scenery assembly. Missing shared collision IDs fall back to the asset's bake; assets without a bake use a footprint. Other districts retain their existing resolver behavior.

The threshold audit covers placements with at least 0.4 m² footprint and 0.5 m height that have a manifest solid flag or substantial baked box. It includes L10 generated decor and farm assembly, and checks active tiers. It is a classification and collider-presence audit, not a visual assessment of every hull. The reported sandbag pallet at (3754.80, -51.16) has eight non-physics-only boxes.

| District | Remaining offenders |
| --- | ---: |
| D-SUBWAY | 1 (int.metro-exit) |
| D-CURE | 0 |
| D-CIVIC, D-CORRIDOR, D-CROSSING, D-EDGE, D-FAIR, D-GROVE, D-MAIN, D-PARK, D-RES, D-SCHOOL, D-SHOP, D-ZOO | 0 each |

See [audit.json](audit.json) for counts and types. Non-L10 rows cover district source layouts, not every level-specific generated decor pass.

## Verification

- Full threat audit, two remote shards merged: 0 acceptance flags; all ten skilled routes completed. L10 skilled completed in 1036.37 simulated seconds. Receipt: `test-results/qa-threat/README.md` and `audit.json`.
- Remote `npm test`: 27 files, 105 passed and one skipped, 192 seconds / 240-second budget; 150/150 case budget.
- Focused world systems decor test passed. Typecheck and lint passed before the final audit-only tier check.
- Audit reports zero L10 offenders at all active tiers. Pallet collision checked directly; this is not a recorded movement contact test.
