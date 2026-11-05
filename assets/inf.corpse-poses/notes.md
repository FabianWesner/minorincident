# Corpse pose set

The original crop and upscaled sheet show four grounded adult civilians: prone, supine, curled on one side, and slumped sitting. The standing/lunging boilerplate is superseded by these explicit reference poses. A ~1.55 m upright base uses a ~0.5 m head silhouette, chunky hands and sneakers. Ivory button shirts, grey trousers, rolled cuffs, brown swept hair and brick-red canvas shoes match the sheet; prone and curled variants retain open grey jackets.

Each pose is separately articulated. First body has the canonical infected node names; subsequent bodies use pose-name namespaces and `canonicalNode` extras, with independent joint trees. Stump caps belong to the proximal joint and export with zero scale, plus `hidden` and `stumpFor` extras. Runtime can extract a pose subtree. Rest transforms are baked to unit-scale, zero-rotation joints while retaining world-space joint pivots. No armature or texture is required.

Smoothing is applied before export. Palette blood patches are ray-projected 4 mm above cloth. Static detail is merged into one multi-material surface per rigid joint. The four-pose combined triangle count is the budget measurement.

Palette token shades: `woodWarm` is tuned to reference hair/sole brown (#76513c), and `asphalt` to reference blue-grey civilian cloth (#596171). All material identities remain palette tokens. No custom texture or shader is used. A multi-material rigid surface exports as one GLB mesh but Three.js expands its material primitives into separate meshes; the report uses GLB mesh count.

Reproduce the complete deliverables from the repository root:

```sh
python3 experiment/tools/blender_run.py ../assets/inf.corpse-poses assets/inf.corpse-poses/build.py -- --render assets/inf.corpse-poses/renders/round5.png --view final-all --glb assets/inf.corpse-poses/model.glb --samples 24 --width 960 --height 540
python3 assets/inf.corpse-poses/validate_glb.py
node experiment/tools/capture_glb.mjs /assets/inf.corpse-poses/model.glb assets/inf.corpse-poses/renders/three
```

`final-all` renders four 960×540 / 24-sample review views, composes the turnaround, renders the 1600×900 / 96-sample hero, then exercises canonical joints and shows `stump_armL` for the pose test. The rest GLB exports before any pose-test mutation. `report.json` reports actual exported triangles, not pre-export Blender estimates.
