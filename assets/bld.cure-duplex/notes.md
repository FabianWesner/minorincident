# Low two-storey brick duplex (R2 residential fringe)

L10 (The Cure), epic 32 row L10-A4, kit `kit.cure-residential`. Forward +X, origin on the ground at the footprint centre, size 10.0 x 14.2 m, height 9.0 m (low-rise: PO "There should be no skyscrapers").

brick walls, brick gable infill proud of the roof end, overhanging asphalt gable roof (ridge along y), two porch canopies with posts and steps, framed windows front/rear/gable ends, chimney, AC unit, downpipes. Materials: brick, picketWhite, asphalt, backpackTeal.

Tiers: LOD0 / LOD1 / LOD2 triangles 9,732 / 2,252 / 372 (caps 12,000 / 4,000 / 1,500). Every tier is authored (not decimated) from closed solids: boxes, prisms and cylinders; LOD1 drops frames/fittings, LOD2 keeps the same extents and the main silhouette parts. Vertex AO is baked after cutting the mesh on a regular grid (big walls otherwise inherit four dark corner values) with a 0.55 floor.

Rebuild:

```sh
python3 tools/blender/run.py assets/bld.cure-duplex/build.py
npm run assets:pack -- bld.cure-duplex
npm run assets:validate -- --ids bld.cure-duplex
```

Recipes live in `tools/blender/sslib/cure_kits.py`. Tests: `tests/unit/assets/cure-kits.test.ts`; Scene Lab: `cure-residential-lineup`, `cure-industrial-lineup`, `cure-res-duplex-door`, `cure-res-security-lane`, `cure-ind-dock`, `cure-ind-stacks`.
