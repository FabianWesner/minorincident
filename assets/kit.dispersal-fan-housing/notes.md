# kit.dispersal-fan-housing

Giant ventilation fan: 4.2 m radius duct ring on a concrete plinth, flanges, safety band, guard grille, motor nacelle on stator vanes and an eight-blade rotor. `fanRotor` is its own spinning node about +X (pivot at the rotor axis, 5.2 m high). Ports `portIntake` (rear) and `portExhaust` (front). About 9.75 m tall.

Dimensions (game Y up): 7.2 x 9.75 x 10.2 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/minigun_cure.py` (shared palette, no textures, deterministic Cycles vertex AO, authored LOD1/LOD2 as closed solids with explicit recipes, no decimation).
Triangles LOD0 / LOD1 / LOD2: 2572 / 1100 / 808 (budget rows proposed in `specs/05-asset-inventory.md` section 7.2: 5000 / 2000 / 900).

Rebuild/publish: `npm run assets:build -- kit.dispersal-fan-housing`. Registry status: integrated; independent asset QA and level placement pending.
