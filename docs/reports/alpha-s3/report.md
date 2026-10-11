A-S3: Alpha Grab and throw / Roar implemented using the shared scheduler, PropThrows, retained corpse poses, E26 bodies, perception and steering.
AC05/06: 0.8 s tells; throw 12 m/s / ≤15 m / 30 damage / 0.8 s knockdown once; Roar 18 m / 1.25× / 5 s / no stacking; cooldowns and checkpoint restore covered.
Validation: typecheck, lint, build pass; Hetzner 34 focused Alpha tests, 205 E07/smoke checks and 5 browser checks pass; incidental remote timing failure passes on Mac (0.652 ms p95).
Full unit: 810 passed; five unchanged asset failures (fire-engine proof/tiers, inventory status, production contracts, duplicate manifest IDs) left to the owning lane.
Captures: both game-camera Scene Lab gates pass; inspected before/after images in review.md show readable tells, visible corpse flight and fall/get-up; wide Roar view retains foot sliding / up to 6.1 cm sinking.
E18: 200/100-infected sim p95 2.345/0.512 ms ≤4/6 ms; live tell draws 39/33 and triangles 672080/375169 within budgets; no baseline worktree, merge or deployment.
