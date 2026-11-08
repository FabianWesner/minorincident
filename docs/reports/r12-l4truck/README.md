# r12-l4truck — L4 truck and courier-follow camera

PO: “L4 glitch” (truck missing parts), and “While playing L4 and in the initial big fight, the camera is moving to highlight something. Don't do that, it's confusing”. Main `08149d1a` is merged. L4 gameplay tuning is unchanged.

## Fixes

- **Truck through the perimeter/sign:** move only rear cargo truck `truck-2` west 6.5 m and south 0.75 m at arrival. The route, convoy timing and other stops stay as authored. Both trucks' actual parked physics hulls clear the perimeter at low/high quality; route/stop registered-solid invariants pass.
- **Canvas appears torn into triangles:** smooth the connected cloth normals in the source builder and asset packer, including all intact/wrecked LODs. Every source model preserves its geometry and winding against main; no part was removed. Native delivered-model inspection confirms body and all six wheels at every LOD, plus intact cab doors, tailgate and canvas. Wrecked doors and canvas are intentionally baked into the damaged body's vertex-color mesh.
- **Opening fight camera takeover:** remove L4 breach, line-1 and armor cinematics and their pauses. Keep the radio calls, breach anchors and HUD marker. The gameplay camera continues following the courier.
- **Wrong old QA criterion:** the existing epic and acceptance clauses required short camera cuts, contradicting the newer PO instruction. The epic/acceptance text and native fixture now require no L4 gameplay camera takeover. No other level's camera behavior changed.

## Verification

- `npm run typecheck`, `npm run lint`, `npm run test:unit`: PASS on the merged source (107 tests, 27 files, Vitest max 4 workers).
- `npm run verify -- E22`: PASS; [receipt](verification.json).
- Focused `L4 vehicles: scripted route and stop poses have no overlap with active registered solids`: PASS (1 test; remaining invariant cases deliberately unselected).
- Native low/high convoy, camera and brace fixtures: all 8 checks PASS; [receipt](native-camera-fixtures.json).
- Actual convoy arrival plus 120 ticks: all 4 truck/quality cases clear the perimeter; [receipt](runtime-truck-audit.json).
- All 6 intact/wrecked GLBs validate with zero errors; [asset validation](asset-validation.json), [LOD geometry/parts](lod-completeness.json), [cloth normals](canvas-audit.json), [measured clearance](clearance-audit.json).
- Requested runner command: `sh tools/remote/run.sh "$PWD" -- node --import tsx/esm tools/qa/threat-audit.ts --levels L4`. Final receipt pending; `PARTIAL_LEVEL_SELECTION` is expected for this diagnostic selection.

The earlier broad `qa:accept --level L4 --skip-browser` run completed low/high routes and passed both fixture/checkpoint stages; stationary policies hit their tick budget. Its stale copied snapshot was removed because it still required camera cuts. The focused current receipts above replace that snapshot. These native checks do not establish rendered appearance.

## Browser QA needed

No browser was started in this coding lane. The browser QA owner should check WebGL2 and manually check WebGPU:

| Level / state | Quality / zoom | Check |
| --- | --- | --- |
| L4 arrival, tick 1949 (32.48 s); rear truck near `(-10.90, 6.45)`, front truck near `(-11, -11.54)` | Low/high; zoom 0.5, 1.0, 1.5 | Complete cab, six wheels, bed and smooth continuous canvas; truck clear of the east perimeter/sign and adjacent bus. Move courier past 8/24 m (high) and 30 m (low) LOD transitions and back; no lost panels or triangular flashes. Repeat wrecked variants in asset/scene review. |
| L4 opening fight: MG pickup through first breach, line-1, nests and armor (+0–182 s after alarm), then Fall back | Low/high; zoom 0.5, 1.0, 1.5 | Camera stays centered on the moving courier; no highlight pan, cinematic pause or input skip. Breach/line/armor radio messages and breach HUD marker still appear. |

No deploy or push.
