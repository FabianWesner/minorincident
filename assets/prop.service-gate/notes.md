# prop.service-gate

Heavy opaque service gate, authored X bracing, steel jambs, hinge barrels and latch. Each tier keeps the filled panel and full closed silhouette. LOD1 drops rivets/collars; LOD2 uses solid low-sided hinges and a combined latch block. No decimation.

Interface: `gate` is the independently animated leaf, hinged at glTF [0, 0, 0.99], yaw 0 closed / -pi/2 open. `gateClosed` and `gateOpen` mark the leaf center in those poses. `latchSocket` moves with the leaf; `braceSlot` stays on the frame. `col:gate` is a cuboid parented to `gate`, with `enabledWhen=closed` and `blocksSightWhen=closed`; jamb proxies remain fixed. `ss_gate` identifies these anchors. Runtime must bind leaf state, movement/sight blockers and brace HP to the existing L6 gate entity; metadata describes that contract and does not implement it. The generated staticCollision entry is the closed pose only: use state-owned gate collision when placing a closable gate.

Fixed root `ss_physics`, metres, +X front, ground Y=0. Clear opening 1.98 m; outer width 2.56 m including feet. Layout lane owns placement, interaction, survivor-clearance and break timing.

Build: `npm run assets:build -- prop.service-gate`, then `npm run assets:pack -- prop.service-gate`. Shared recipes in `tools/blender/sslib/subway_fixtures.py` use sslib palette/primitives/sockets/colliders/export and rescue `Scene` conventions. Explicit `--distance-tier 0|1|2 --glb <path>` emits only the requested tier; ordinary build authors all three. Applied export scale is 1, with one Z-up to Y-up conversion. AO contrast is bounded to keep broad surfaces readable at game scale. Triangle caps 1500/600/200, <=8 total material primitives including moving/emissive assemblies.

QA: `test-results/l6-service-gates-and-lights/prop.service-gate/comparison.png`, `authored-lod-reference.jpg`, `lod-contact.png`, `game-reference-peer.jpg` and `game-camera.json`. Measurements: `report.json`. Orchestrator visual acceptance remains independent.
