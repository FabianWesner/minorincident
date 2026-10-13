# kit.dispersal-console

Control console with sloped desk, three screens and a button row. The central `progress screen` is its own `screen` node (emissive teal) with socket `progressScreen`; `operator` socket marks the stand position on +X.

Dimensions (game Y up): 1.615 x 2.025 x 3.3 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/minigun_cure.py` (shared palette, no textures, deterministic Cycles vertex AO, authored LOD1/LOD2 as closed solids with explicit recipes, no decimation).
Triangles LOD0 / LOD1 / LOD2: 492 / 184 / 148 (budget rows proposed in `specs/05-asset-inventory.md` section 7.2: 600 / 300 / 200).

Rebuild/publish: `npm run assets:build -- kit.dispersal-console`. Registry status: integrated; independent asset QA and level placement pending.
