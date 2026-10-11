# Alpha human derivative

`build.py` executes the existing worker build in a redirected namespace, then reshapes its finished surfaces and joint positions. It adds no panels, boxes, horns, armor or textures. Body height scale is 1.45; extra depth/breadth is 1.14/1.22. The head is reduced locally by 0.82/0.82/0.90 so the broader torso reads as an adult human. Measured final height is approximately 2.51 m (1.395× the 1.8 m worker), within the PO 1.35–1.5× requirement.

All original human animated joints and stump caps survive, with unit joint scales and identity rest rotations. Hidden caps export real unit-scale geometry with `hidden` metadata; this avoids regeneration into extra flesh/bone materials. Palette: infectedSkin, asphalt, blood and emissive infectedEye. Ordinary shared run, swing, knockdown and get-up clips are tested on every delivered tier; far geometry uses the existing `simplifyCrowdLod` path and preserves emissive eye vertices.

Rebuild headlessly:

```sh
python3 tools/blender/run.py assets/inf.alpha/build.py --glb assets/inf.alpha/model.glb
npm run assets:pack -- inf.alpha
npm run assets:validate -- --ids inf.alpha
```

Triangle caps include hidden caps: LOD0 8,000; LOD1 3,000; LOD2 1,000. LOD0 file cap 800 KiB, four materials, no image textures. See [review and measured delivery](../../docs/reports/alpha-asset/review.md).

The A-D1 isolated fixtures use the shipped firefighter brain with a model override. This avoids Scene Lab's automatic L1 runner→civilian appearance conversion and keeps the 3.8 m/s human pursuit/animation path. The worker comparison uses the existing `infected.runner` crowd key (asset `inf.common-worker`). These fixtures verify art and district placement; the `infected.alpha` definition, resistance, health bar, four moves, campaign counts and actual line destruction are owned by the other E07 lanes.
