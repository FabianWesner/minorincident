# Alpha human derivative

`build.py` executes the existing worker build in a redirected namespace. Before the worker joins its surfaces, the Alpha removes office accessories and thin hair locks, broadens the curved chest/shoulder surfaces, enlarges the hands and advances the neck. The torso has a deeper 0.30 radian lurch. Dark torn torso clothing, bruised purple skin, raised blood wounds and red emissive chest veins use four palette materials; larger eyes remain readable at distant zoom. Packed height is 2.580 m (1.433× the 1.8 m worker), within the PO 1.35–1.5× requirement.

LOD1/LOD2 voxel-union each rigid owner's material surfaces before reduction, using 4.5/8.5 cm source voxels; emissive eyes keep their authored geometry before reduction. Reduced surfaces are welded, punctures closed, and collapsed flat islands removed. The exported LOD1/2 meshes have zero boundary/non-manifold edges. This removes thin cuff/garment shards without joining different animated owners. There are no image textures or new runtime materials. Packed totals, including hidden caps: 7,777 / 2,794 / 872 triangles; LOD0 72.35 KiB. The separately derived Mega now matches Alpha height and stays below 1.3× both horizontal extents. Its dark shoulder mass, bone armour/spine ridge and glowing veins remain distinct. The worker source is unchanged. See [2026-10-15 review](../../docs/reports/alpha-look/review.md).

All original human animated joints and stump caps survive, with unit joint scales and identity rest rotations. Hidden caps export real unit-scale geometry with `hidden` metadata; this avoids regeneration into extra flesh/bone materials. Palette: purple, uiDark, blood and emissive infectedEye. Ordinary shared run, swing, knockdown and get-up clips are tested on every delivered tier; far geometry still uses the existing `simplifyCrowdLod` path and preserves emissive eye vertices.

Rebuild headlessly:

```sh
python3 tools/blender/run.py assets/inf.alpha/build.py --glb assets/inf.alpha/model.glb
npm run assets:pack -- inf.alpha
npm run assets:validate -- --ids inf.alpha
```

Triangle caps include hidden caps: LOD0 8,000; LOD1 3,000; LOD2 1,000. LOD0 file cap 800 KiB, four materials, no image textures. See [review and measured delivery](../../docs/reports/alpha-asset/review.md).

The A-D1 isolated fixtures use the shipped firefighter brain with a model override. This avoids Scene Lab's automatic L1 runner→civilian appearance conversion and keeps the 3.8 m/s human pursuit/animation path. The worker comparison uses the existing `infected.runner` crowd key (asset `inf.common-worker`). These fixtures verify art and district placement; the `infected.alpha` definition, resistance, health bar, four moves, campaign counts and actual line destruction are owned by the other E07 lanes.

## Look variants (PO #23, 2026-10-19)

PO: "I prefer if alphas could have different looks. At the moment they all look the same." `variants.py` defines four sibling assets built by the same `build.py` (`--variant <name>`, output in `assets/inf.alpha-<name>/`): `worker` (olive skin, denim bib overalls, yellow hard hat, shoulder tumour), `hoodie` (ash skin, teal hood up, bone spikes through the back), `fire` (dark skin, orange turnout jacket, helmet with rear brim, bone plate on the right shoulder) and `suit` (cyanotic skin, torn grey suit with coat tails and tie remains, exposed skull growth, swollen forearm). They share the rig, pose, scale and animation set (same joint positions, unit scales), stay within +10% of the base's triangles and file size at every LOD, and use palette tokens only (up to six materials, so a few more primitives per standalone model; the crowd bakes each look into one geometry). Heights are within about 1.5% of the base. Rebuild: `python3 tools/blender/run.py assets/inf.alpha/build.py --glb assets/inf.alpha-worker/model.glb --variant worker`, then `npm run assets:pack -- inf.alpha-worker`.

The look is chosen at draw time by `alphaLook(asset, entityId)` (`src/data/alphaLooks.ts`, index 0 is the shipped Alpha): a pure function of the entity id, never read by the sim, so replays and checkpoints are unchanged. An explicit `look.model: inf.alpha` (Scene Lab fixtures) keeps the original asset. Each look on screen is one instanced batch per LOD (a live scene with eight Alphas in five looks drew 40 calls against 38 with the base only); an Alpha instance adds none. QA scenes: `alpha-variants-lineup`, `alpha-variants-close`, `alpha-variants-live`, `mega-alpha-variants-lineup` (in the matrix filter). Mega looks: see `assets/inf.mega-alpha/notes.md`.
