# prop.fluorescent-strip

Long cool fixture with two recessed tubes, thick end caps, central separator, rim and mounting brackets. LOD1 reduces tube sides and omits fasteners; LOD2 omits socket collars, retaining two complete tubes. No decimation.

Interface: `light:fluorescent` point anchor uses `light_fluorescent`, `metro-main`, fluorescent flicker, 9 m range and a surviving `body_emi_picketWhite` batch. `mountSocket` is the rear attachment point. Root physics is fixed. Layout rotates/positions this wall-oriented fixture for ceiling mounting and controls spacing; runtime owns switching, flicker and break state. Warm shelter lamps use their independent groups.

Build: `npm run assets:build -- prop.fluorescent-strip`, then `npm run assets:pack -- prop.fluorescent-strip`. Shared recipes in `tools/blender/sslib/subway_fixtures.py` use sslib palette/primitives/sockets/colliders/export and rescue `Scene` conventions. Explicit `--distance-tier 0|1|2 --glb <path>` emits only the requested tier; ordinary build authors all three. Applied export scale is 1, with one Z-up to Y-up conversion. AO contrast is bounded to keep broad surfaces readable at game scale. Triangle caps 1500/600/200, <=8 total material primitives including moving/emissive assemblies.

QA: `test-results/l6-service-gates-and-lights/prop.fluorescent-strip/comparison.png`, `authored-lod-reference.jpg`, `lod-contact.png`, `game-reference-peer.jpg` and `game-camera.json`. Measurements: `report.json`. Orchestrator visual acceptance remains independent.
