# Sandbagged guard post (R4 military zone, checkpoint MG pickup anchor)

L10 (The Cure), epic 32 row L10-A5, kit `kit.cure-military`. Forward +X, origin on the ground at the footprint centre, size 9.0 x 9.35 m, height 7.2 m with the radio mast (blockhouse roof at 3.4 m; low-rise).

Concrete-pad blockhouse with steel door, gun slits on four sides, roof parapet, camouflage net on four poles, radio mast and floodlight; open sandbag enclosure in front (two runs with a lane gap for the door, two returns). Reuse `prop.jersey-barrier`, `decay.blown-sandbags`, `kit.guard-tower` and the military vehicles around it. Materials: olive, khaki, uiDark, sidewalk.

Tiers: LOD0 / LOD1 / LOD2 triangles 4,556 / 1,320 / 284 (caps 8,000 / 3,000 / 1,000). Every tier is authored from closed solids (LOD0 stacks single bags, LOD1 one slab per row, LOD2 one block); the mast stays at every tier so the extents match.

Rebuild:

```sh
python3 tools/blender/run.py assets/bld.cure-guard-post/build.py
npm run assets:pack -- bld.cure-guard-post
npm run assets:validate -- --ids bld.cure-guard-post
```

Recipes live in `tools/blender/sslib/cure_kits_a5.py` (on top of `cure_kits.py`). Tests: `tests/unit/assets/cure-kits.test.ts`; Scene Lab: `cure-mil-lineup`, `cure-mil-post-lane`.
