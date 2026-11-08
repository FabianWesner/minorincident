# r12-l4truck — L4 army truck and opening fight

PO batch 59 defects, plus the PO's 2026-11-08 camera note. Scope is limited to the truck, its canvas, the opening L4 camera takeover and regression checks.

## Findings and fixes

- **Barrier/sign overlap:** the scripted second cargo truck parked at x = −4.4. Its 6.93 m physics hull extended through the east perimeter at x = −6.7. The route and other convoy stops remain unchanged; only this truck shifts west by 6.5 m and south by 0.75 m after arrival, putting it wholly inside the barrier with clearance from the adjacent bus. The authored vehicle OBB vs. registered-solid invariant now has a named assertion for the parked truck and perimeter.
- **Canvas shards:** the canvas is one triangulated cloth mesh, authored with flat face normals. The bright triangular patches in the PO image follow those triangles. The source mesh now uses smooth, weighted normals, and the asset optimizer applies matching normals to coincident cloth vertices for every delivered LOD and truck variant. The three intact truck LODs were repacked and validated with zero asset errors; existing triangle budgets pass. Blender regeneration was unavailable here because its Metal backend crashed, so this targeted packer path was used.
- **Opening fight camera:** L4 previously took over the camera for the first breach, first line collapse and tank/armor line collapse. Those takeovers and their 1.6 s pause were removed. Existing breach/line/armor radio calls and the breach HUD marker remain; the game camera follows the courier.

`docs/qa/level-acceptance.md` L4-09 now requires follow-camera framing, and L4-18 includes the truck placement/collider clearance check (PO 2026-11-08). The named OBB assertions live in `tests/qa/invariants/contract.test.ts` and the L4 contact suite.

## Other levels checked

- **L3:** `l3AttackView` eases the camera to 1.5× scale through attack, fallback and corridor phases while the courier remains near the yard, to keep the station fight and escort in frame (`src/data/l3.ts`, `src/render/GameView.ts`). This is the only other similar mid-combat camera movement found. Left unchanged per PO instruction.
- **L1:** story beats take the camera for authored narrative moments; not a mid-combat highlight.
- **L7, L9 and L10:** camera movement is tied to the bus departure, crash handover and cure epilogue respectively; these are ending/transition sequences, not mid-combat highlights. Left unchanged.

## Visual evidence

- **Before:** opened [`1108-l4-truck.webp`](../../../epics-pipeline/po-findings/1108-l4-truck.webp). The truck bumper/wheel cross the perimeter beside the yellow sign; repeated bright triangles line the canvas folds.
- **After:** not captured. Headless Scene Gate could not start its browser pool: `listen EPERM 127.0.0.1:4329`; direct local fetches also return EPERM. The legacy runner is blocked by the macOS GPU guard failing to spawn `ps` with `Operation not permitted`. No visual comparison sheet is claimed.
- Native acceptance outputs are in [`qa-accept/README.md`](qa-accept/README.md) and [`qa-accept/L4.json`](qa-accept/L4.json), with the six native receipts linked from that report. The final corrected native rerun is still active; update this report when it exits.

## Verification

Asset validation passed (`tools/assets/validate.ts --ids veh.military-truck`, zero errors). `npm run typecheck` and `npm run lint` passed on the final code. The final `npm test` run stayed within its 150 case cap (150/150): 106 passed; one existing `gate-tools` review freshness case returned `STALE` where it expects `FRESH`. The focused L4 route invariant and L4 contact suite both pass, including the occupied barricade landing check.

`qa:accept L4 --skip-browser` on the first parking variants exposed two bad approaches: moving the route endpoint made L4-01 convoy arrival 193.15 s (target 20–35), and shifting the whole column west conflicted with the north barricade landing. Both were discarded. Final code preserves route timing and other stop poses, moving only truck-2 west 6.5 m and south 0.75 m on arrival. The corrected native acceptance rerun is pending. `scene:gate` ended with 0/50 rows because the browser pool could not bind port 4329 (EPERM); visual captures remain unavailable in this sandbox. No deploy or push.
