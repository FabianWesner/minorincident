# s48-l3l5regress — scope the supermarket collision bake

## Result

The threat audit is back at the requested 17 flags: L1 0, L2 1, L3 1, L4 4, L5 1, L6 4, L7 6, L8 0, L9 0, L10 0. L3 retains only `KITING_LANDED_HITS_BELOW_2`; L5 retains only `SKILLED_BELOW_ATTACKS_PER_MINUTE_3`. The L4 shop pocket remains open on high and low. No combat stats, corpse behavior, or audit thresholds changed.

## Regression cause

The s46 checkout rebuild changed the delivered supermarket GLB and regenerated `staticCollision['bld.supermarket']` for every placement of that shared asset. The meaningful collision changes are boxes 159 and 160: the long checkout-side collider at local x −0.47..0.53, z −3.2801..−1.405 moved to x 0.23..1.2303, z −3.2801..−1.405, while the thin post moved from x 0.875..0.925 to x −0.155..−0.105. This geometry change was needed by L4, but applying its baked navigation/physics footprint to L3 and L5 caused the L3 squad-loss failure and left a L5 chaser stuck near `(4.96, -9.04)` for over 30 seconds in both look and search.

The L8BossArenas s46 change was unrelated. A controlled A/B replacing only the shared supermarket collision record with its pre-s46 bake removed all three new gameplay flags; only the baseline L3 and L5 flags remained (plus the expected partial-selection diagnostic). The exact final L3/L5 audit reproduced that baseline.

## Fix

Keep the new delivered GLB and current collision bake as the canonical `bld.supermarket` record, preserving hash/data consistency for L4 and other default users. Retain the previous record as `bld.supermarket.legacy`. L3's D-CORRIDOR transformation and L5's D-FAIR aftermath transformation explicitly select that legacy collision ID for supermarket placements. L4 uses the current bake by default. L7 inherits the L5 transformation.

## Verification

- Full `node --import tsx/esm tools/qa/threat-audit.ts`: 17 flags with per-level counts above.
- Focused `node --import tsx/esm tools/qa/threat-audit.ts --levels L3,L5`: 3 total entries including `PARTIAL_LEVEL_SELECTION`; the only gameplay flags are the two baselines.
- `QUALITY=high node --import tsx/esm tools/qa/r42/l4-pocket-probe.ts`: courier at actual pose `(5.8966, 36.3888)` loses 20 HP by tick 200.
- `QUALITY=low node --import tsx/esm tools/qa/r42/l4-pocket-probe.ts`: same pose loses 20 HP by tick 200 and further health by tick 400.
- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm test`: 27 files, 107 passed; test-budget collected 150/150 cases and completed in 71 seconds (240-second budget).
- `node node_modules/vitest/vitest.mjs run tests/qa/invariants/war-waves.test.ts --project nightly --maxWorkers=4 --configLoader runner`: 2 passed.
- The requested `sh tools/remote/run.sh "$PWD" -- npm test` could not start because the runner reported no healthy Hetzner runner and this command is not admitted to its local fallback. The equivalent local `npm test` passed with the configured four-worker cap.

The required `sh tools/ops/slim-worktree.sh "$PWD" --no-assets` was attempted first, but the sandbox denied its write to the shared `.git/worktrees/.../config.worktree`. The existing worktree and `node_modules` were present. No assets or protected reference directories were edited.
