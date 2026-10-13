# kit.dispersal-pipe-tee

T junction with a valve on the branch: run along X (ports `portA` -4, `portB` +4) and a branch toward +Y (`portC` at (0, 4)), height 2.4 m.

Dimensions (game Y up): 8.08 x 4.41 x 5.34 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/minigun_cure.py` (shared palette, no textures, deterministic Cycles vertex AO, authored LOD1/LOD2 as closed solids with explicit recipes, no decimation).
Triangles LOD0 / LOD1 / LOD2: 1292 / 500 / 300 (budget rows proposed in `specs/05-asset-inventory.md` section 7.2: 1700 / 700 / 300).

Rebuild/publish: `npm run assets:build -- kit.dispersal-pipe-tee`. Registry status: integrated; independent asset QA and level placement pending.
