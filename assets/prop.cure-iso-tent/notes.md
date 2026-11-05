# Isolation tent (R5 research campus medical/quarantine area)

L10 (The Cure), epic 32 row L10-A5, kit `kit.cure-research`. Forward +X (airlock annex), origin on the ground at the tent centre, size 6.3 x 7.6 m, height 3.1 m. Fixed collider (body and annex). The stock `prop.tent` stays in use for plain medical tents; this one adds the airlock and hazard trim.

White gabled tent on a floor slab with a yellow eave band, clear panels in the long walls, airlock annex with yellow roof and dark door, guy ropes and stakes (inside the footprint). Materials: picketWhite, schoolBusYellow, uiDark, sidewalk.

Tiers: LOD0 / LOD1 / LOD2 triangles 2,128 / 748 / 156 (caps 4,000 / 1,500 / 500). Authored closed solids at every tier.

Rebuild: `python3 tools/blender/run.py assets/prop.cure-iso-tent/build.py`, then `npm run assets:pack -- prop.cure-iso-tent` and `npm run assets:validate -- --ids prop.cure-iso-tent`.

Recipes: `tools/blender/sslib/cure_kits_a5.py`. Tests: `tests/unit/assets/cure-kits.test.ts`; Scene Lab: `cure-research-lineup`, `cure-res-tent-generator`.
