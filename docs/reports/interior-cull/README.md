1. Implemented load-time footprint ownership and interior geometry partitions; closed buildings omit interior instances, with same-frame reveal/inside toggles.
2. PO L5 high: draws 140→139, triangles 492,155→304,263; low: draws 115→114, triangles 179,461→158,409.
3. [Eight before/after L4/L5 measurements](measurements.md): every measured draw/triangle budget holds; culling CPU max 0.1 ms across 480 samples.
4. Added five Scene Lab catalog scenes; 60 geometry + 12 final reveal matrix cases pass on both backends, tiers and required zooms; [captures reviewed](review.md).
5. Typecheck/lint/build pass; remote full unit 1,517 pass, browser smoke 16 pass; [validation](validation.md) records broader continuity, mobile-fixture and L4-low-hitch failures.
6. Scope is PO 27(a) only; no deployment, merge, test-limit relaxation or simulation/collision changes.
