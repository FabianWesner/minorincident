# Mega Alpha (L10 final boss)

`build.py` derives from the shipped worker exactly like `inf.alpha` (same node names, identity rest rotations, hidden stump caps), so the Alpha special-move clips retarget unchanged. The PO 2026-10-15 revision matches the regular Alpha's height (2.585 m versus 2.580 m). Its packed X/Z rest extents are 1.693/2.955 m versus 1.395/2.414 m: ratios 1.21/1.23, below the 1.3 limit at every tier. The 14 degree hunch is baked into geometry. Bulk is 1.03 and right-arm enlargement is 1.08; a front-to-back compression keeps the hunch inside the footprint.

Strength reads through dark bruised skin/muscle, near-black rags, bone shoulder armour and spine spikes, blood scars, enlarged red eyes and glowing chest/back veins. Six palette materials, no textures.

Packed tiers including caps: 15,587 / 5,648 / 1,908 triangles. Reduced bodies are closed solids from per-material voxel unions. Shared joint hierarchy, ordinary/special clips and hidden caps remain intact. Asset tests enforce both horizontal extent ratios ≤ 1.3 and matching height. The close-contact/arrival/speed Scene Lab gates compare visible pixels with a regular Alpha at the same transform/pose (≥ 0.9), retaining courier visibility ≥ 0.6. See [revision report](../../docs/reports/alpha-look/review.md).

Rebuild:

```sh
python3 tools/blender/run.py assets/inf.mega-alpha/build.py --glb assets/inf.mega-alpha/model.glb
npm run assets:pack -- inf.mega-alpha
npm run assets:validate -- --ids inf.mega-alpha
```

Budgets (manifest): 16,000 / 6,000 / 2,000 triangles, 6 materials, 1,600 KB LOD0. QA: `specs/scenes/catalog/inf-mega-alpha-lineup.json` (`npm run scene:catalog -- --matrix --filter 'inf-mega-alpha-lineup'`) and `npx tsx tools/scenelab/lod-objectives.ts <out> inf.mega-alpha`.
