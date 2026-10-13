# Main research laboratory (R5 research campus)

L10 (The Cure), epic 32 row L10-A5, kit `kit.cure-research`. Forward +X (entry side), origin on the ground at the main block centre, size 26.6 x 14.7 m, height 7.45 m (single storey plus roof plant, dish mast the tallest point). PO: "low modern laboratory buildings"; no skyscraper facade.

Flat-roofed white block on a plinth with parapet, glazed entry vestibule with canopy on two posts and a step, ribbon windows on all sides, two side doors, roof plant (condensers, exhaust stacks, satellite dish). The terminal/cure anchors are placed by the level, not part of this mesh. Materials: picketWhite, sidewalk, uiDark, backpackTeal.

Tiers: LOD0 / LOD1 / LOD2 triangles 9,298 / 3,012 / 360 (caps 16,000 / 6,000 / 2,000). Authored closed solids at every tier; vertex AO baked after a regular grid cut with a 0.7 floor.

Rebuild: `python3 tools/blender/run.py assets/bld.cure-lab-main/build.py`, then `npm run assets:pack -- bld.cure-lab-main` and `npm run assets:validate -- --ids bld.cure-lab-main`.

Recipes: `tools/blender/sslib/cure_kits_a5.py`. Tests: `tests/unit/assets/cure-kits.test.ts`; Scene Lab: `cure-research-lineup`, `cure-res-lab-front`.
