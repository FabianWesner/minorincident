# Low flat-roof service/utility building (R3)

L10 (The Cure), epic 32 row L10-A4, kit `kit.cure-industrial`. Forward +X, origin on the ground at the footprint centre, size 11.2 x 8.2 m, height 7.0 m (low-rise: PO "There should be no skyscrapers").

parapet roof with two condensers and a stack, double door with yellow frame, louvres, rear pipe run, meter box, bollards. Materials: sidewalk, asphalt, uiDark, schoolBusYellow.

Tiers: LOD0 / LOD1 / LOD2 triangles 4,188 / 1,642 / 320 (caps 16,000 / 6,000 / 2,000). Every tier is authored (not decimated) from closed solids: boxes, prisms and cylinders; LOD1 drops frames/fittings, LOD2 keeps the same extents and the main silhouette parts. Vertex AO is baked after cutting the mesh on a regular grid (big walls otherwise inherit four dark corner values) with a 0.55 floor.

Rebuild:

```sh
python3 tools/blender/run.py assets/bld.cure-service-building/build.py
npm run assets:pack -- bld.cure-service-building
npm run assets:validate -- --ids bld.cure-service-building
```

Recipes live in `tools/blender/sslib/cure_kits.py`. Tests: `tests/unit/assets/cure-kits.test.ts`; Scene Lab: `cure-residential-lineup`, `cure-industrial-lineup`, `cure-res-duplex-door`, `cure-res-security-lane`, `cure-ind-dock`, `cure-ind-stacks`.
