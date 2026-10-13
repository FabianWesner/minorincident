# kit.dispersal-pipe-elbow

90 degree bend: 1 m stub, R = 3 m arc, 1 m stub. Ports `portA` (-4, 0) heading +X and `portB` (0, +4) heading +Y, height 2.4 m.

Dimensions (game Y up): 5.8 x 3.62 x 5.8 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/minigun_cure.py` (shared palette, no textures, deterministic Cycles vertex AO, authored LOD1/LOD2 as closed solids with explicit recipes, no decimation).
Triangles LOD0 / LOD1 / LOD2: 1220 / 400 / 240 (budget rows proposed in `specs/05-asset-inventory.md` section 7.2: 1600 / 600 / 300).

Rebuild/publish: `npm run assets:build -- kit.dispersal-pipe-elbow`. Registry status: integrated; independent asset QA and level placement pending.
