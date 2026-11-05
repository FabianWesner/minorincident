# Police/security post with lane canopy (R2 entrance, handgun pickup anchor)

L10 (The Cure), epic 32 row L10-A4, kit `kit.cure-residential`. Forward +X, origin on the ground at the footprint centre, size 9.9 x 8.2 m, height 4.9 m (low-rise: PO "There should be no skyscrapers").

booth with blue band, glazing on three sides, rear door, roof beacons; canopy over a vehicle lane on four posts with a blue fascia and sign board; red bollards. Reuse `prop.checkpoint-gate` and `prop.jersey-barrier` for the barrier arm and blocks. Materials: picketWhite, policeBlue, uiDark, survivorRed.

Tiers: LOD0 / LOD1 / LOD2 triangles 3,580 / 1,112 / 256 (caps 12,000 / 4,000 / 1,500). Every tier is authored (not decimated) from closed solids: boxes, prisms and cylinders; LOD1 drops frames/fittings, LOD2 keeps the same extents and the main silhouette parts. Vertex AO is baked after cutting the mesh on a regular grid (big walls otherwise inherit four dark corner values) with a 0.55 floor.

Rebuild:

```sh
python3 tools/blender/run.py assets/bld.cure-security-post/build.py
npm run assets:pack -- bld.cure-security-post
npm run assets:validate -- --ids bld.cure-security-post
```

Recipes live in `tools/blender/sslib/cure_kits.py`. Tests: `tests/unit/assets/cure-kits.test.ts`; Scene Lab: `cure-residential-lineup`, `cure-industrial-lineup`, `cure-res-duplex-door`, `cure-res-security-lane`, `cure-ind-dock`, `cure-ind-stacks`.
