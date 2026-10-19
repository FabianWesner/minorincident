# Alpha human derivative

`build.py` executes the existing worker build in a redirected namespace. Before the worker joins its surfaces, the Alpha removes office accessories and thin hair locks, broadens the curved chest/shoulder surfaces, enlarges the hands and advances the neck. The torso has a deeper 0.30 radian lurch. Dark torn torso clothing, bruised purple skin, raised blood wounds and red emissive chest veins use four palette materials; larger eyes remain readable at distant zoom. Packed height is 2.580 m (1.433× the 1.8 m worker), within the PO 1.35–1.5× requirement.

All three LODs voxel-union each rigid owner's material surfaces before reduction, using 2.25/4.5/8.5 cm source voxels; emissive eyes keep their authored geometry before reduction. Reduced surfaces are welded, punctures closed, and collapsed flat islands removed. The exported meshes have zero boundary/non-manifold edges. This removes thin cuff/garment shards without joining different animated owners. There are no image textures or new runtime materials. Packed totals, including hidden caps: 7,516 / 2,794 / 872 triangles; LOD0 59.78 KiB. The separately derived Mega now matches Alpha height and stays below 1.3× both horizontal extents. Its dark shoulder mass, bone armour/spine ridge and glowing veins remain distinct. The worker source is unchanged. See [2026-10-15 review](../../docs/reports/alpha-look/review.md).

All original human animated joints and stump caps survive, with unit joint scales and identity rest rotations. Hidden caps export real unit-scale geometry with `hidden` metadata; this avoids regeneration into extra flesh/bone materials. Palette: purple, uiDark, blood and emissive infectedEye. Ordinary shared run, swing, knockdown and get-up clips are tested on every delivered tier; far geometry still uses the existing `simplifyCrowdLod` path and preserves emissive eye vertices.

Rebuild headlessly:

```sh
python3 tools/blender/run.py assets/inf.alpha/build.py --glb assets/inf.alpha/model.glb
npm run assets:pack -- inf.alpha
npm run assets:validate -- --ids inf.alpha
```

Triangle caps include hidden caps: LOD0 8,000; LOD1 3,000; LOD2 1,000. LOD0 file cap 800 KiB, four materials, no image textures. See [review and measured delivery](../../docs/reports/alpha-asset/review.md).

The A-D1 isolated fixtures use the shipped firefighter brain with a model override. This avoids Scene Lab's automatic L1 runner→civilian appearance conversion and keeps the 3.8 m/s human pursuit/animation path. The worker comparison uses the existing `infected.runner` crowd key (asset `inf.common-worker`). These fixtures verify art and district placement; the `infected.alpha` definition, resistance, health bar, four moves, campaign counts and actual line destruction are owned by the other E07 lanes.
