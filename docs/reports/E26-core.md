# E26 core — props and barricades

Lane: `props-barricades`, 2026-10-07. This delivers the wave-1 core under the staging decision in specs/04 §6. It does not close the whole E26 epic. Specs were not changed. No push, main merge-out, or deployment was performed.

## Changes and commits

- `7ec79b22 feat(E26): add authored physics props and barricade lifecycle`
- `22b56eb2 Merge branch 'main' into lane/props-barricades` (includes main through `9d9ade25`).
- `79709daa fix(E26): retain attackers at braces and integrate mission break events`
- `8ab9a4aa fix(E26): approach obstructing rails and keep brace overlays visible`

GLB `ss_physics` and collider metadata now bake during layout builds into a deterministic TypeScript table, with source hashes. All 80 records are retained; 31 movable environment assets qualify for the prop system. Vehicles and pickups retain their existing systems. Props use authored mass, collision boxes, friction, restitution, center of mass, class/push rules and break/barricade HP. Bodies start sleeping; rendering skips unchanged poses. Fallen props reset at y < −5. The production awake cap remains **12**; the stress fixture alone overrides it to 60.

Authored slots support projected coverage, a 1.5 s brace at ≥80% coverage, 2 s board-up (200 HP), repairs of 25% maximum HP per 2 s, kinematic membership, damage/break sound and VFX hooks, and inward release on break. Overlapping coverage is counted once. Movement interrupts the stand interaction. Board-up has no materials cost because spec 07 explicitly describes construction without inventory. Infected prefer short detours, attack blocking rails otherwise, remain at the rail between attacks, and invalidate routes when blockers change. Break removes the nav blocker in the same tick.

Mission predicates are `world.barricades.barricadeIntact(slotId)` and `allBarricaded(groupId)`. Built/broken/repaired events carry entity ID, slot ID, group ID and tick. Membership and HP survive checkpoint restore and physics/tier rebuild. L4's E11 bridge-blockade proxy is now a real barricade actor; the checked-in L2 graph contained no equivalent proxy. L2 Alvarez/gym, L4 substation and L5 fallback anchors receive baseline rails. District data and composition overrides can author additional rails. L5's full 3–5 slots per fallback and associated prop placement remain content work.

## Validation

Final validation ran serially to avoid simultaneous production builds. Browser runs were headless, locked, and used preview port 3326; workers stayed within repository limits.

| Exact command | Result |
| --- | --- |
| `npm run typecheck` (also executed by verify) | PASS |
| `npm run lint` (also executed by verify) | PASS |
| `sh tools/sim-lock.sh npx vitest run tests/sim/barricades.test.ts tests/sim/props.test.ts tests/sim/missions/adapters.test.ts tests/sim/ai/animals.test.ts --maxWorkers=2` | PASS: 36 tests, 4 files |
| `sh tools/sim-lock.sh npm run test:unit -- --maxWorkers=2 --reporter=default --reporter=json --outputFile=test-results/epics/E26/unit.json` | PASS: 245 tests, 76 files |
| `E2E_PORT=3326 sh tools/sim-lock.sh npm run verify -- E26` | PASS: typecheck, lint, production build; 14 selected Vitest tests (622 skipped); 26 Playwright tests, ≤2 workers |
| `E2E_PORT=3326 sh tools/sim-lock.sh npm run test:smoke` | PASS: 5 selected Vitest tests (631 skipped); 22 Playwright tests, ≤2 workers |

The actual serial shell held one `tools/sim-lock.sh` lease around these four test commands, rather than reacquiring it between commands. Verify and smoke invoke `tools/e2e-lock.sh` themselves. Logs and JSON are under `test-results/epics/E26/` in this lane worktree.

### Performance evidence

Both profiles run 60 continuously awake props and 30 attacking runners, sampling six seconds after two seconds of warmup. GPU: ANGLE Metal, Apple M4. Headless Chrome frame limiting/vsync were disabled. `perf-high.json` and `perf-low.json` retain frame samples and workload counts.

| Profile | Frame p95 / budget | Sim p95 / budget | Attacks observed |
| --- | --- | --- | --- |
| Desktop high, native CPU | 8.9 / 16.7 ms | 0.7 / 4 ms | 180 |
| Low, 390×844, 4× CPU throttle | 10.1 / 33.4 ms | 2.7 / 6 ms | 210 |

Both stayed at exactly 60 awake bodies and 30 infected. This measures the synthetic barricade fixture with instanced box props. It is not a real-phone GPU measurement or a full-town production-art performance claim. Those measurements are still needed before raising production budgets.

## Acceptance coverage

| AC | Status and evidence |
| --- | --- |
| 02 | Delivered: 300 sleeping props after 1 s; browser verifies zero matrix updates after settling. |
| 07 | Delivered reset behavior: below −5 resets asleep within one tick. The optional remove flag is implemented; the test covers reset. |
| 09 | Delivered: coverage gate, exact 90-tick brace, summed HP, kinematic bodies and blocked nav. |
| 10 | Delivered: ten spaced runners hit a 400 HP closed rail at the defined cadence over four volleys; Brute damage multiplier is 5×; real prop brace releases with inward/upward velocity and nav opens immediately. Ten attackers packed into a narrow doorway are constrained by crowd spacing. |
| 12 | Delivered: exact 120-tick board-up, 200 HP, 25% repairs, movement interruption. |
| 01 | Partial: metadata extraction/provenance and valid positive collider boxes covered. Full mass/COM/15% visual/explosive-reference validation is open; authored defects below. |
| 03 | Partial: 35 kg authored bench moves with player at 55%; heavy requires the `shoulderPush` seam and then uses 25%. Authored cart is 24 kg; campaign upgrade-card integration is open. |
| 06 | Partial: waking 250 bodies retains nearest bodies under the existing 12 cap. Explosion triggering and off-screen prioritization are open. Budgets are upper bounds, so 150/60 production caps were not introduced. |
| 16 | Partial: ghost, percentage prompt, brace bars, crack and shake exist; three fixture screenshots captured. Full W0/W5 readability/vision review and clear airborne break sequence are open. |
| 04, 05, 08, 11, 13, 14, 15 | Deferred: kick/momentum damage, explosion impulses, unbraced moving-prop nav updates, vault/cover, car bracing, complete-bot A/B defense, and the specified 60 s cross-runtime hash sequence. Existing push determinism regression remains green. |

Every delivered criterion has an `@E26-ACnn` test. Additional core metadata, checkpoint, route and mission tests are present. Tagged tests on partial criteria cover only the stated increment; a green verify selection does not establish full epic completion.

## Deviations, issues and next increments

- Explicitly deferred as requested: freeform construction, vaulting, car bracing and momentum combat. Nothing was removed from specs.
- `folio-2025` was unavailable; proceeded under the orchestrator's instruction using existing repo systems.
- Authored metadata audit found four class/mass mismatches: plank-stack heavy/95 kg, sofa heavy/65 kg, porta-potty heavy/90 kg, trash-bin light/24 kg; jukebox COM `[0,0,0.8]` lies outside its collider. They were surfaced to the orchestrator. Assets were not silently reclassified or rewritten. See `metadata-audit.json`.
- Collider size exports mix Blender XYZ and glTF Y-up conventions. The bake resolves size ordering against existing geometry bounds, then uses authored cuboids or existing static boxes. Parent/compound collider transforms and full 15% agreement need the remaining asset-validation increment.
- Rails use conservative AABBs; axis-aligned authored rails are recommended. Cached detour selection uses a 300-expansion path budget. Resting unbraced props are not yet dynamic nav obstacles (AC08).
- Placeholder fixture boxes and three desktop screenshots provide implementation evidence, not visual acceptance. The intact screenshot can show a distant board-up prompt clipped at the screen edge; prompt placement and full W0/W5 art review remain AC16 work. See `review.md`.
- Full L2/L4/L5 defense composition, prep phases, barricade-aware bots, shoulder-upgrade card wiring and real phone/full-town perf are later increments. The APIs and authoring seams are ready for those lanes.

Evidence location: `/Users/wesner/Workspace/minorincident/.claude/worktrees/props-barricades/test-results/epics/E26/`.
