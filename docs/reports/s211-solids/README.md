# s211 — solid placement audit

PO 2026-11-20 reported walking through the L10 sandbag pallet. The pallet already had baked collision hulls, but generated decor was skipped unless individually tagged `decorSolid`. Several L10 placements also set `collisionId: look-l10-box`; the runtime looked up that absent ID without falling back to the asset's baked shape.

## Change

- Decor placements now use their baked asset hulls, or their manifest footprint when the solid asset has no bake. Non-solid decor remains render-only.
- An unknown optional `collisionId` now falls back to the placement asset's own baked collision. This restores collision for L10 fence, pallet, vehicle, and kit placements using the shared look ID.
- Added per-kit collision walls for `kit.shelter-camp` (its bake only covered the floor) and a `kit.zoo-tunnel-mouth` shell with its authored doorway open.
- The subway exit now uses only its perimeter hulls; the baked stair and escalator step hulls crossed their authored walking lanes. The upper exit doorway and movement routes remain clear.
- Added a district-wide native placement audit to an existing `world-systems` test, so the suite remains at 150 cases.

## Audit

The audit checks every placement in each district layout (and the assembled L10 layout) at all active tiers. It considers placements at least 0.4 m² and 0.5 m high with a manifest solid flag or a substantial baked collision box. `audit.json` has the per-district before/after counts and top previous offender types.

| District | Before | After |
| --- | ---: | ---: |
| D-CIVIC | 0 | 0 |
| D-CORRIDOR | 0 | 0 |
| D-CROSSING | 0 | 0 |
| D-CURE (L10 assembled) | 186 | 0 |
| D-EDGE | 0 | 0 |
| D-FAIR | 0 | 0 |
| D-GROVE | 0 | 0 |
| D-MAIN | 0 | 0 |
| D-PARK | 0 | 0 |
| D-RES | 0 | 0 |
| D-SCHOOL | 0 | 0 |
| D-SHOP | 0 | 0 |
| D-SUBWAY | 1 | 0 |
| D-ZOO | 0 | 0 |
| **Total** | **187** | **0** |

L10's largest before groups were `prop.cure-mil-fence` (113), `prop.cure-quarantine-fence` (39), and `prop.sandbag-pallet` (13). The remaining district counts and top offenders are in [audit.json](audit.json). The threshold audit is a data/pipeline check; it does not claim visual review or prove every arbitrary asset is correctly classified in the manifest.

## Verification

- Focused test: `tests/engine/world-systems.test.ts -t 'solid placement audit'` — passed after the final metro stair-hull adjustment; it also assembles L10 and asserts generated placements have colliders.
- `node --import tsx/esm tools/qa/solid-placement-audit.ts` — 187 before, 0 after.
- `npm run typecheck` and `npm run lint` — passed.
- Focused player movement test — passed after removing the stair/escalator step hulls.
- Focused mission checkpoint test — still fails: two L6 survivors do not relocate to the Northgate exit fixture coordinates after the new solid collision behavior. Investigate and re-run before treating all-level behavior as complete.
- Full threat sharding completed locally after 946.5 s with 5 flags: L6 early close/tick budget and route hit count, L8 follower delays, and L10 kiting hit count. L6 skilled route was incomplete; other skilled routes completed. The ordinary `npm run qa:threat` timed out at its 600-second budget. Remote sharded QA could not start because no healthy runner was available.
- Local `npm test` exceeded its 240-second budget and reported the mission checkpoint failure above plus the player movement failure; the latter passed when rerun after the metro hull adjustment. Remote `sh tools/remote/run.sh "$PWD" -- npm test` could not start because no healthy runner was available.
- The HIGH, zoom 1 PO pallet scene was captured after browser access was restored and visually inspected: the courier is outside the sandbags. The scene stages the courier at the edge; it does not exercise pressing movement into the pallet, so that contact still needs a gameplay capture. The image is in `pallet-after/shot-0000.png` in the worktree. `scene:gate` remains unverified.
- An earlier commit attempt was blocked by the sandbox denying access to the Git index; the environment was subsequently changed to allow Git writes.
