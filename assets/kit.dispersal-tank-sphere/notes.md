# kit.dispersal-tank-sphere

Spherical pressure tank (R = 3.6 m) on eight legs with an equator band, top nozzle, relief pipe, ladder, drain and a ground outlet port `portOutlet` toward +X. 12.8 m tall.

Dimensions (game Y up): 10.475 x 12.8 x 8.79 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/minigun_cure.py` (shared palette, no textures, deterministic Cycles vertex AO, authored LOD1/LOD2 as closed solids with explicit recipes, no decimation).
Triangles LOD0 / LOD1 / LOD2: 1560 / 700 / 488 (budget rows proposed in `specs/05-asset-inventory.md` section 7.2: 2800 / 1200 / 700).

Rebuild/publish: `npm run assets:build -- kit.dispersal-tank-sphere`. Registry status: integrated; independent asset QA and level placement pending.
