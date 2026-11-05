# kit.dispersal-tank-bullet

Twin horizontal pressure vessels (10 m, R = 2.2 m) on saddles with a railed catwalk bridge, manifold and an outlet port `portOutlet` toward +X.

Dimensions (game Y up): 11.83 x 7.335 x 10.6 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/minigun_cure.py` (shared palette, no textures, deterministic Cycles vertex AO, authored LOD1/LOD2 as closed solids with explicit recipes, no decimation).
Triangles LOD0 / LOD1 / LOD2: 1932 / 980 / 436 (budget rows proposed in `specs/05-asset-inventory.md` section 7.2: 3000 / 1500 / 700).

Rebuild/publish: `npm run assets:build -- kit.dispersal-tank-bullet`. Registry status: integrated; independent asset QA and level placement pending.
