# Two pallets of four drums each (R3 service prop)

L10 (The Cure), epic 32 row L10-A4, kit `kit.cure-industrial`. Forward +X, origin on the ground at the footprint centre, size 1.3 x 1.1 m, height 2.1 m (low-rise: PO "There should be no skyscrapers").

pallet stringers and deck boards, banded drums in two colours. Materials: woodWarm, survivorRed, backpackTeal, uiDark.

Tiers: LOD0 / LOD1 / LOD2 triangles 1,056 / 640 / 264 (caps 3,000 / 1,000 / 300). Every tier is authored (not decimated) from closed solids: boxes, prisms and cylinders; LOD1 drops frames/fittings, LOD2 keeps the same extents and the main silhouette parts. Vertex AO is baked after cutting the mesh on a regular grid (big walls otherwise inherit four dark corner values) with a 0.55 floor.

Rebuild:

```sh
python3 tools/blender/run.py assets/prop.cure-drum-stack/build.py
npm run assets:pack -- prop.cure-drum-stack
npm run assets:validate -- --ids prop.cure-drum-stack
```

Recipes live in `tools/blender/sslib/cure_kits.py`. Tests: `tests/unit/assets/cure-kits.test.ts`; Scene Lab: `cure-residential-lineup`, `cure-industrial-lineup`, `cure-res-duplex-door`, `cure-res-security-lane`, `cure-ind-dock`, `cure-ind-stacks`.
