# Vehicle shelter (R4 motor pool)

L10 (The Cure), epic 32 row L10-A5, kit `kit.cure-military`. Forward +X (open side), origin on the ground at the footprint centre, size 8.7 x 11.9 m, height 4.55 m.

Steel-post canopy over two vehicle bays: olive roof with a yellow fascia on the open side, eight posts, cross beams, concrete back wall, wheel stops, a tool locker, two fuel drums and two light strips (LOD0 only). Park `veh.military-truck` / `veh.military-apc` inside. Materials: olive, uiDark, khaki, schoolBusYellow.

Tiers: LOD0 / LOD1 / LOD2 triangles 2,864 / 552 / 144 (caps 8,000 / 3,000 / 1,000). Authored closed solids at every tier; LOD1 drops locker, drums and lamps, LOD2 also beams and wheel stops.

Rebuild: `python3 tools/blender/run.py assets/bld.cure-motor-shelter/build.py`, then `npm run assets:pack -- bld.cure-motor-shelter` and `npm run assets:validate -- --ids bld.cure-motor-shelter`.

Recipes: `tools/blender/sslib/cure_kits_a5.py`. Tests: `tests/unit/assets/cure-kits.test.ts`; Scene Lab: `cure-mil-lineup`, `cure-mil-shelter`.
