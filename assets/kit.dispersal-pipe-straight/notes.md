# kit.dispersal-pipe-straight

Large pipe run (8 m long, 2 m diameter, axis at 2.4 m) on two concrete saddles with hazard-yellow clamp bands and flanges. Ports `portA` (-4, 0) and `portB` (+4, 0), both at height 2.4 m.

Dimensions (game Y up): 8.08 x 3.62 x 2.6 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/minigun_cure.py` (shared palette, no textures, deterministic Cycles vertex AO, authored LOD1/LOD2 as closed solids with explicit recipes, no decimation).
Triangles LOD0 / LOD1 / LOD2: 900 / 348 / 188 (budget rows proposed in `specs/05-asset-inventory.md` section 7.2: 1200 / 500 / 250).

Rebuild/publish: `npm run assets:build -- kit.dispersal-pipe-straight`. Registry status: integrated; independent asset QA and level placement pending.
