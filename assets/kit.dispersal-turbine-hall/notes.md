# kit.dispersal-turbine-hall

Low-rise turbine hall block (16 x 7 m, 9 m with the monitor roof) with a hazard-framed roller door on +X, window slits, pilasters, two roof stacks and an exposed turbine casing + generator along the south wall. Sockets `door`, `steamPort`.

Dimensions (game Y up): 16.8 x 11.5 x 12.2 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/minigun_cure.py` (shared palette, no textures, deterministic Cycles vertex AO, authored LOD1/LOD2 as closed solids with explicit recipes, no decimation).
Triangles LOD0 / LOD1 / LOD2: 1692 / 996 / 740 (budget rows proposed in `specs/05-asset-inventory.md` section 7.2: 4000 / 1800 / 1200).

Rebuild/publish: `npm run assets:build -- kit.dispersal-turbine-hall`. Registry status: integrated; independent asset QA and level placement pending.
