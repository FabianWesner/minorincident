# Q-124/125/126/127/129 · implementation and evidence in progress

Base: `bfff62015` (batch 13j). No deployment or merge.

- Q-124: actual delivered Alpha boots exceeded 1 m above ground. The death presentation now settles the leg chain with unchanged segment lengths and levels the soles. Mega uses its authored side fall, exposing the head profile, arms and legs. Tests cover all eight delivered Alpha/Mega looks. The 65 cm absolute boot-top limit applies to the requested face-down Alphas; the side-lying Mega instead checks level soles and bounded boot thickness, since its upper hip lies above the lower one.
- Regular infected corpses: prepared LOD1 frozen pages inside 8 m, retained to 10 m on retreat. Spatial queries inspect nearby bodies only; page swaps preserve IDs, transforms, tint and overlays and do not invalidate the animated membership list. No bodies or population counts are removed.
- Q-125: infected bars require positive HP, including recoverable downed Alphas. The previous zero-HP/recovery-timer case failed before the eligibility fix.
- Q-127: the low departure shot exposed cool sky rectangles where warm ground haze ended. A precompiled uniform blends the same haze into the backdrop during this shot. Camera and map bounds are unchanged. The first full-shot review still showed warm rectangles at the final frame; fully fogged surfaces now converge to the identical backdrop colour after height haze. A second matrix is pending.
- Q-129: wedge top was 5.68 m against the 5.70 m span. Wedge top is now 5.71 m, closing the dark step. D-CORRIDOR base GLB and layout metadata rebuilt successfully.
- Q-126: three cold, quiet production WebGPU/low/z1.5 reproductions cross the L1 reported street and trigger the L2 ride by physical keyboard input. Unchanged baseline maxima: L1 16.8/16.8/16.8 ms; L2 50.0/50.0/49.9 ms. CPU profiles and all frames retained in `test-results/fixes-13k/hitches-target-before-r2/`. The original 266/450 ms stalls have not reproduced under these conditions; candidate profiles and attribution remain required.

Focused regression suites: 45 passing tests. Earlier full unit run had 2,019 passing tests and six sandbox-dependent failures; rerun after the environment was unlocked is pending.

Outstanding: complete capture matrix and review; L10 paired quiet p95; candidate stall profiles; invariants; PROD A/B review; remote unit+level suites; smoke; final completion audit.

Performance checkpoint: the first quiet pair retained 282 corpses but regressed WebGL2 median p95 3.2 → 3.9 ms and WebGPU 2.2 → 2.6 ms. This is rejected. Frozen regular-corpse palette constants are now uploaded once per body instead of selecting 34 palette entries per vertex; the new identity/swap-removal test checks exact float32 constants and the WebGL2 16-attribute limit. Typecheck, lint and 26 focused tests pass; runtime and replacement timing remain pending.
