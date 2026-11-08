# R13 destruction — progress

## Implemented in this step

- Added deterministic per-weapon damage responses for glass, wood, metal, brick, and concrete.
- Routed direct hits on existing destructible environment entities through the material response table.
- Routed weapon-attributed explosion damage to destructible props and vehicles through the same table. Environmental chain explosions retain their authored damage curve.
- Added material inference for existing destructible prop, vehicle, and building archetype IDs.
- Removed unlinked historical test captures and traces from this worktree to free space.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test:unit` — 150-case budget passed; suite failed in two tests. The destruction change initially interrupted the existing propane chain test; that regression was fixed and its containing `tests/engine/world-systems.test.ts` file now passes (5 tests). The other failure is `tests/tools/gate-tools.test.ts` review freshness (`STALE` vs `FRESH`).
- `git diff --check` — passed.

## Remaining

This is an incomplete foundation, not the end-to-end feature. Placement-addressable damage to static buildings and parked vehicles, first-hit static-batch splitting, damage variant swaps, breached collision/nav updates, pooled detachable debris, fire propagation to structures, district gameplay integration, captures, and the required scene/threat gates remain to be implemented and verified. No captures have been generated in this step.
