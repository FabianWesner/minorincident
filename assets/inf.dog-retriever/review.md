# Final review

Final animal budget overrides the human infected budget: LOD0 must be at most 12,000 triangles.

Five modeling rounds preserve the reference’s golden coat, cream muzzle/chest, floppy ears, red collar with brass buckle and round tag, red emissive eyes, open fang-filled mouth, wound locations, feathered raised tail, chunky paws and leading-paw lunge. The painted coat and wound micro-detail are deliberately simplified for the crowd budget.

- LOD0: 11,801 exported triangles, 35 glTF mesh definitions, 89 material primitives. Blender counts 11,802 before the exporter drops a degenerate face.
- LOD1: 1,892 triangles. Material boundaries, red eyes, and small rigid-part volumes are protected.
- LOD2: 1,612 triangles. Small fur locks are removed before reduction, preserving the solid body silhouette.
- All three GLBs share the exact required node transforms and hierarchy, have zero-scale hidden proximal stump caps and contain no image textures. `validation.json` records the checks.
- WebGPU and WebGL2 load all three GLBs without console warnings or errors. `browser-checks.json` and `renders/three*` record the results.
- Hero: 1600×900, Cycles 96 samples. Review views and both pose views: 960×540, 24 samples. `turnaround.png` contains front, side, back and three-quarter views.
- `pose-test.png` compares armL/foreArmL/legR rotation with front-left limb removal and visible stump_armL. Paw joint volumes close rigid-part seams.

Final hero and turnaround compared with reference-upscaled.png and the original crop once more. Build helpers remain small and purposeful; applied subdivision is reduced before export, static parts are merged per rigid parent, and LOD2 uses a face mask to remove tiny locks rather than collapse the anatomy.

Rebuild all GLBs and individual delivery views:

```sh
python3 experiment/tools/blender_run.py ../assets/inf.dog-retriever assets/inf.dog-retriever/build.py -- --glb assets/inf.dog-retriever/model.glb --render assets/inf.dog-retriever/renders/hero.png --view final --samples 96 --width 1600 --height 900
```

The labeled turnaround and pose-test sheets assemble the individual renders without resampling them.
