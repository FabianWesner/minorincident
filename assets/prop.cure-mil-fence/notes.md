# Perimeter fence panel (R4 military zone)

L10 (The Cure), epic 32 row L10-A5, kit `kit.cure-military`. 3.0 m panel along local x (placed in a row), origin on the ground at the panel centre, size 3.34 x 0.42 m, height 2.48 m. Fixed collider (fence line blocks the player and infected, like the garden wall).

Two olive posts on concrete bases, dark chain-link panel, top/mid/low rails and a razor-wire coil along the top (wire rings at LOD0). Materials: olive, khaki, uiDark.

Tiers: LOD0 / LOD1 / LOD2 triangles 476 / 124 / 92 (caps 1,000 / 400 / 150). Authored closed solids at every tier.

Rebuild: `python3 tools/blender/run.py assets/prop.cure-mil-fence/build.py`, then `npm run assets:pack -- prop.cure-mil-fence` and `npm run assets:validate -- --ids prop.cure-mil-fence`.

Recipes: `tools/blender/sslib/cure_kits_a5.py`. Tests: `tests/unit/assets/cure-kits.test.ts`; Scene Lab: `cure-mil-lineup`, `cure-mil-shelter`.
