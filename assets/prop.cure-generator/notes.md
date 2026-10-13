# Emergency generator (R5 research campus)

L10 (The Cure), epic 32 row L10-A5, kit `kit.cure-research`. Forward +X (control panel end), origin on the ground at the skid centre, size 2.8 x 1.2 m, height 2.4 m. Physics class heavy, 600 kg, not pushable.

Orange enclosure on a steel skid with louvre bays on both long sides, dark lid with a cable coil, control panel with gauge and red e-stop, exhaust stack with rain cap, lifting eye, day tank (LOD0). Materials: orange, uiDark, sidewalk, survivorRed.

Tiers: LOD0 / LOD1 / LOD2 triangles 572 / 312 / 196 (caps 3,000 / 1,000 / 300). Authored closed solids at every tier.

Rebuild: `python3 tools/blender/run.py assets/prop.cure-generator/build.py`, then `npm run assets:pack -- prop.cure-generator` and `npm run assets:validate -- --ids prop.cure-generator`.

Recipes: `tools/blender/sslib/cure_kits_a5.py`. Tests: `tests/unit/assets/cure-kits.test.ts`; Scene Lab: `cure-research-lineup`, `cure-res-tent-generator`.
