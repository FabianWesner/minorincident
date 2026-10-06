# Modeling notes

Source: `initial-drafts/l1v2-neighborhood-kit-2.png`, crop [1243,746,1655,877]. Side tier as explicitly requested. Three independent placement parents: `road_closed`, `mesh_fence`, `excavator`; metres, +X front, Z up, ground z=0.

Barricade: about 2 m wide and 1.7 m tall, diagonal orange raised reflectors, black-bordered cream sign, two circular amber lenses. Fence: 2.2 m span, open 12-by-8 lattice, bow and shallow sag. Excavator: about 4 m including scoop, 1.6 m wide, 2.7 m high; capsule-shaped track bands, separate shoe geometry, wheel hubs, yellow counterweight and framed opaque blue cab, articulated boom silhouette, hydraulic cylinders, open metal bucket and teeth.

Use `src/assets/palette.json` through sslib.palette; no textures. Original illegible barricade subline clarified as ROAD WORK. Canonical orange is softer than the sheet's hot red-orange. Opaque navy windows deliberately preserve palette styling.

Rebuild: `python3 experiment/tools/blender_run.py ../assets/kit.edge-roadwork assets/kit.edge-roadwork/build.py -- --glb assets/kit.edge-roadwork/model.glb --render assets/kit.edge-roadwork/renders/game.png`. Then `npx tsx assets/kit.edge-roadwork/optimize.ts`.

Manifest is untouched: integrator must reconcile current distant tier/4k budget with explicitly requested side tier, use report.json actual dimensions, and add script/source/LOD paths. Kit colliders are per piece and coarse. Excavator is static map-edge dressing.

Delivery: build exports all three GLBs with deterministic CPU Cycles AO; optimize.ts applies the project glTF-transform/meshopt pipeline locally. validate.ts runs the shared validator against the measured side-tier contract without registering it. Only final hero and game-camera images are retained. WebGPU must be reviewed manually.
