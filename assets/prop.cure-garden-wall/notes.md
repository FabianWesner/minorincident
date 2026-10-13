# Masonry garden wall segment with iron rail (3 m, instanceable)

L10 (The Cure), epic 32 row L10-A4, kit `kit.cure-residential`. Forward +X, origin on the ground at the footprint centre, size 3.5 x 0.5 m, height 1.9 m (low-rise: PO "There should be no skyscrapers").

brick wall, coping, two capped pillars, iron bars and rails. Materials: brick, picketWhite, uiDark.

Tiers: LOD0 / LOD1 / LOD2 triangles 360 / 120 / 84 (caps 1,000 / 400 / 150). Every tier is authored (not decimated) from closed solids: boxes, prisms and cylinders; LOD1 drops frames/fittings, LOD2 keeps the same extents and the main silhouette parts. Vertex AO is baked after cutting the mesh on a regular grid (big walls otherwise inherit four dark corner values) with a 0.55 floor.

Rebuild:

```sh
python3 tools/blender/run.py assets/prop.cure-garden-wall/build.py
npm run assets:pack -- prop.cure-garden-wall
npm run assets:validate -- --ids prop.cure-garden-wall
```

Recipes live in `tools/blender/sslib/cure_kits.py`. Tests: `tests/unit/assets/cure-kits.test.ts`; Scene Lab: `cure-residential-lineup`, `cure-industrial-lineup`, `cure-res-duplex-door`, `cure-res-security-lane`, `cure-ind-dock`, `cure-ind-stacks`.
