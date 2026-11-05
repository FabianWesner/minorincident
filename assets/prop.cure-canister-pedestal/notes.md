# prop.cure-canister-pedestal

Research-lab pickup version: octagonal concrete plinth and column, steel top plate with three clamp arms, canister upright with the window facing +X, emissive teal band on the column. `pickupSocket` marks the interaction point above the canister.

Dimensions (game Y up): 1.4 x 1.705 x 1.4 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/minigun_cure.py` (shared palette, no textures, deterministic Cycles vertex AO, authored LOD1/LOD2 as closed solids with explicit recipes, no decimation).
Triangles LOD0 / LOD1 / LOD2: 628 / 490 / 328 (budget rows proposed in `specs/05-asset-inventory.md` section 7.2: 1000 / 700 / 400).

Rebuild/publish: `npm run assets:build -- prop.cure-canister-pedestal`. Registry status: integrated; independent asset QA and level placement pending.
