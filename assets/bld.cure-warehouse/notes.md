# Low gabled warehouse with loading docks (R3 industrial area, 18 x 30 m footprint, ridge 10 m)

L10 (The Cure), epic 32 row L10-A4, kit `kit.cure-industrial`. Forward +X, origin on the ground at the footprint centre, size 23.2 x 32.0 m, height 10.0 m (low-rise: PO "There should be no skyscrapers").

five dock doors with ribs and yellow frames on the +x front, raised dock platform with edge strip and bumpers, canopy on posts, clerestory band, pilasters, side man doors with stoops, ridge vents and two roof condensers, downpipes, bollards. Materials: sidewalk, asphalt, uiDark, schoolBusYellow.

Tiers: LOD0 / LOD1 / LOD2 triangles 12,436 / 3,980 / 440 (caps 16,000 / 6,000 / 2,000). Every tier is authored (not decimated) from closed solids: boxes, prisms and cylinders; LOD1 drops frames/fittings, LOD2 keeps the same extents and the main silhouette parts. Vertex AO is baked after cutting the mesh on a regular grid (big walls otherwise inherit four dark corner values) with a 0.55 floor.

Rebuild:

```sh
python3 tools/blender/run.py assets/bld.cure-warehouse/build.py
npm run assets:pack -- bld.cure-warehouse
npm run assets:validate -- --ids bld.cure-warehouse
```

Recipes live in `tools/blender/sslib/cure_kits.py`. Tests: `tests/unit/assets/cure-kits.test.ts`; Scene Lab: `cure-residential-lineup`, `cure-industrial-lineup`, `cure-res-duplex-door`, `cure-res-security-lane`, `cure-ind-dock`, `cure-ind-stacks`.
