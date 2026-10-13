# kit.dispersal-filtration-tower

Three-stage filtration tower, 17.8 m (limit about 18 m): concrete plinth, banded stages, cone top and vent stack, two catwalk rings with railings, glowing teal status slits, riser pipe on -X, access ladder and a side duct to port `portDuct` (+X, 7.5 m).

Dimensions (game Y up): 11.9 x 17.8 x 8.6 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/minigun_cure.py` (shared palette, no textures, deterministic Cycles vertex AO, authored LOD1/LOD2 as closed solids with explicit recipes, no decimation).
Triangles LOD0 / LOD1 / LOD2: 2036 / 924 / 464 (budget rows proposed in `specs/05-asset-inventory.md` section 7.2: 4000 / 1600 / 800).

Rebuild/publish: `npm run assets:build -- kit.dispersal-filtration-tower`. Registry status: integrated; independent asset QA and level placement pending.
