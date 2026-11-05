# Quarantine annex (R5 research campus)

L10 (The Cure), epic 32 row L10-A5, kit `kit.cure-research`. Forward +X (airlock side), origin on the ground at the block centre, size 12.8 x 12.2 m, height 7.15 m (exhaust stacks the tallest point).

Smaller flat-roofed lab wing: airlock vestibule with yellow roof, hazard chevrons over a double door and a biohazard sign, louvred plant wall, scrubber tank with duct and two stacks on the -Y side, ribbon windows, roof condenser. Materials: picketWhite, sidewalk, uiDark, schoolBusYellow.

Tiers: LOD0 / LOD1 / LOD2 triangles 5,206 / 1,588 / 336 (caps 16,000 / 6,000 / 2,000). Authored closed solids at every tier.

Rebuild: `python3 tools/blender/run.py assets/bld.cure-lab-annex/build.py`, then `npm run assets:pack -- bld.cure-lab-annex` and `npm run assets:validate -- --ids bld.cure-lab-annex`.

Recipes: `tools/blender/sslib/cure_kits_a5.py`. Tests: `tests/unit/assets/cure-kits.test.ts`; Scene Lab: `cure-research-lineup`, `cure-res-annex-airlock`.
