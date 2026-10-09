# prop.emergency-light

Compact red safety fixture with chamfered metal housing, gasket, solid red lens, smaller emissive core, grille bars and wall tabs. LOD1 drops guard side rails, LOD2 drops bolts. Faceted lens/housing profiles remain solid in every tier. No decimation.

Interface: `light:emergency` point anchor uses `light_siren_red`, `metro-emergency`, 9 m range, no flicker and surviving `body_emi_redDark`. The surrounding `pal_sirenRed` lens stays red as a physical surface while the core follows power state. `mountSocket` is the rear attachment point. Fixed root physics. Layout owns <=15 m spacing and mounting height; runtime owns switching and break behavior.

Build: `npm run assets:build -- prop.emergency-light`, then `npm run assets:pack -- prop.emergency-light`. Shared recipes in `tools/blender/sslib/subway_fixtures.py` use sslib palette/primitives/sockets/colliders/export and rescue `Scene` conventions. Explicit `--distance-tier 0|1|2 --glb <path>` emits only the requested tier; ordinary build authors all three. Applied export scale is 1, with one Z-up to Y-up conversion. AO contrast is bounded to keep broad surfaces readable at game scale. Triangle caps 1500/600/200, <=8 total material primitives including moving/emissive assemblies.

QA: `test-results/l6-service-gates-and-lights/prop.emergency-light/comparison.png`, `authored-lod-reference.jpg`, `lod-contact.png`, `game-reference-peer.jpg` and `game-camera.json`. Measurements: `report.json`. Orchestrator visual acceptance remains independent.
