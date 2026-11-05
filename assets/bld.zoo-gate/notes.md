Native Blender exterior and LOD1/LOD2, authored in tools/blender/sslib/park_zoo.py.

Reference style: existing bld.house-b window casings, sill volumes and roof seams; bld.police-station civic courses and recessed glazing. Reuses sslib.rescue_assets.Scene, palette, export and AO. +X forward; origin at ground; manifest dimensions and original solid lot footprint retained. LOD0 keeps soft bevels; distance tiers use complete solids with fewer small details.

Build: `python3 tools/blender/run.py assets/bld.zoo-gate/build.py --glb assets/bld.zoo-gate/model.glb`, then `npm run assets:pack -- bld.zoo-gate`.

Inspection and delivered budgets: docs/reports/asset-defects.md and docs/scenes/asset-defects/.
