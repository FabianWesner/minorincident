# Quarantine fence panel (R5 research campus)

L10 (The Cure), epic 32 row L10-A5, kit `kit.cure-research`. 3.0 m panel along local x (placed in a row), origin on the ground at the panel centre, size 3.18 x 0.9 m, height 2.1 m. Fixed collider.

White sheeting between two steel posts on feet, hazard-yellow top and bottom bands, dark top rail, biohazard sign on the +Y face (fictional marking). Materials: picketWhite, schoolBusYellow, uiDark.

Tiers: LOD0 / LOD1 / LOD2 triangles 268 / 136 / 84 (caps 1,000 / 400 / 150). Authored closed solids at every tier.

Rebuild: `python3 tools/blender/run.py assets/prop.cure-quarantine-fence/build.py`, then `npm run assets:pack -- prop.cure-quarantine-fence` and `npm run assets:validate -- --ids prop.cure-quarantine-fence`.

Recipes: `tools/blender/sslib/cure_kits_a5.py`. Tests: `tests/unit/assets/cure-kits.test.ts`; Scene Lab: `cure-research-lineup`, `cure-res-lab-front`, `cure-res-annex-airlock`.
