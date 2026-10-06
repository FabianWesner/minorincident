# Roadwork kit review

Verdict: accepted for the requested side-tier map-edge scope; matches the concept's three recognizable pieces. Compared the original crop and cleaned image with final `renders/hero.png` and `renders/game.png` in Eevee with material backface culling enabled.

The striped white A-frame, cream ROAD CLOSED plate, paired amber warning lamps, open bowed/sagging orange safety mesh, yellow tracked excavator, glazed-looking framed cab, counterweight/grilles, hydraulic cylinders/pins, and open scoop with teeth are present. The game view shows the entire kit, with clear gaps between its pieces and no clipping. Raised lettering, plate borders and reflective stripes are solid geometry, separated from backing faces; no coplanar decals. Bucket floor and side cheeks remain visible with backface culling.

Refinement addressed text fitting, excessive bevel/web density, the scoop floor's rectangular beam orientation, a coarse authored far LOD, framing, and centered ground contact. Three semantic parents remain independently placeable: road_closed, mesh_fence and excavator. Colliders are empty coarse cuboids per piece; the excavator is static dressing.

Delivered triangles: LOD0 11,724; LOD1 1,512 (12.9%); LOD2 400 (3.4%). Draw calls 14/14/8. Meshopt-compressed files approximately 129/37/11 KB, below the 300 KB side-tier limit. Palette materials only, no textures; deterministic 32-sample CPU baked AO on each tier. Shared validator passes all three tiers for geometry, palette, dimensions, nodes, forward marker and budgets. See validation.json and determinism.json for measured evidence.

Intentional differences: palette orange is warmer/more muted than the concept's red-orange; the fence lattice is less dense; illegible small barricade subline is clarified as ROAD WORK. Canonical excavator front is +X, so the grouped review angle differs from the sheet's individual side view. Far LOD removes lettering and minor hardware, retaining all three silhouettes.

Integration pending: manifest untouched. Its distant-tier/4k roadwork placeholder conflicts with this explicitly requested side-tier build. Actual glTF dimensions are approximately X=4.254, Y=2.732, Z=7.389 m. Integrator must reconcile dimensions/tier/budgets and add script/source/LOD paths before flipping status. WebGPU review remains manual. WebGL2 status is recorded separately if the shared browser slot becomes available.

Final validation: npm run typecheck and npm run lint passed; npm run test:unit -- --maxWorkers=4 passed (200 tests, 2 skipped files, 2 todo tests). WebGL2 was not run because the shared browser lock remained occupied; the queued smoke check was cancelled. No claim of browser verification. WebGPU remains a manual integration check.
