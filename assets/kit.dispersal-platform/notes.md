# kit.dispersal-platform

Steel platform 8 x 4 m at 3 m with columns, braces, railings and a 15-step stair down the +X end. Sockets `stairTop`, `stairBottom`.

Dimensions (game Y up): 12.303 x 4.165 x 4.4 m. Blender Z up, front +X, ground z=0.

Source: `build.py` and `tools/blender/sslib/minigun_cure.py` (shared palette, no textures, deterministic Cycles vertex AO, authored LOD1/LOD2 as closed solids with explicit recipes, no decimation).
Triangles LOD0 / LOD1 / LOD2: 880 / 580 / 556 (budget rows proposed in `specs/05-asset-inventory.md` section 7.2: 1800 / 900 / 600).

Rebuild/publish: `npm run assets:build -- kit.dispersal-platform`. Registry status: integrated; independent asset QA and level placement pending.
