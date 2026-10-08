# L2 street chair

## Source and fixes

The matching chair is authored W1 dressing: `l2-belongings-33`, `prop.broken-chair`, at `(-28.4, -20)` in `src/levels/L2/layout.ts`. Its footprint overlaps the Larch Street driving lane. The rescue controller only spawns corpse entries from that dressing list. This checkout has no `src/levels/continuity.ts` or `src/sim/progression/carryover.ts`; normal level loading resets the world.

L2 assembly now removes inherited pushable furniture that overlaps a road and relocates loose dressing beside roads, including diagonal candidates at intersections. The chair moves to `(-26.4, -20)`. Intentional checkpoint barriers and vehicle wrecks remain allowed. Saved pushable poses supplied to L2 assembly are checked too; a road pose falls back to the safe authored home. Checkpoint restoration and decay-tier rebuilds preserve props displaced during play.

Rendering resolves each pushable's lowest selected-LOD mesh vertex against `DistrictView.groundAt`, the drawn-ground height field already used by vehicles. Sleeping props rest at that contact; awake props keep positive airborne clearance. Rotation stays with the rigid body. Contact is cached until pose, sleep state, or selected mesh changes.

The broken wooden chair's previous LOD1/LOD2 had only 312/76 triangles, down from 2,624. Decimation removed thin solid boards. All three chair builds now preserve their full solid geometry at every tier, with authored triangle caps to prevent repacking from simplifying it: 2,624 triangles for the wooden chair and 1,520 for each lawn chair. This deliberately trades a small increase in distant-chair triangles and download size for an intact silhouette.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npx vitest run tests/unit/layouts --maxWorkers=2`: 22 tests passed, 7 files.
- `npx vitest run tests/unit/levels/l2-roads.test.ts tests/unit/assets/runtime-integration.test.ts --maxWorkers=2`: 8 tests passed, 2 files. Covers clear roads, saved poses, checkpoint/tier preservation, and all chair LOD geometry.
- `npm run scene -- specs/scenes/l2-street-chair.json`: passed after the final contact-cache change, 60 frames, headless Chromium WebGL2/ANGLE Metal. Sink maximum `2.08e-15 cm` (numerical zero), 210 contact samples, zero console errors, zero static clipping pairs and actor hits. Authored roadside chair selected LOD2; lawn chairs selected LOD1 at the last frame. Three screenshots inspected: solid slats, a believable side-resting wooden chair on asphalt, and the authored chair on pavement. Evidence: `test-results/scenes/l2-street-chair/`.
- `SIM_WAIT=60 sh tools/sim-lock.sh npx vitest run tests/unit --maxWorkers=2`: blocked by occupied shared sim slots; no tests executed. The queued request was cancelled after an extended wait.
- `E2E_PORT=3357 npm run test:smoke`: blocked on its shared sim lock; no smoke results available. The waiting attempt was cancelled, and its later retry chained after full unit validation never started. Other lanes’ lock holders were left running.

## Scope

No acceptance criteria changed. The new JSON scene under `specs/scenes/` is the requested regression fixture. It deliberately puts displaced fixture chairs on the road; the authored layout is independently checked for road clearance. Vitest uses two workers because this machine was overloaded. WebGPU remains a manual check under repository policy.

Commits: `6e469316` (chair assets), `0f6a8a39` (placement/contact and regression scene), `020301de` (contact cache).
