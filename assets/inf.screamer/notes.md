# Screamer construction

Adult infected, about 1.7 m including hair; skull and mane roughly one third of the silhouette, following the accepted Worker. +X forward, Z up, character right -Y. Feet on z=0. Wide bent stance, elbows raised and claw hands beside the temples as in the clean turnaround.

Part list: oversized cranium, jaw with boolean mouth cavity, lips, gums, individual teeth, tongue, nose and nostrils, brow and orbital shapes, red emissive eyes; 68 broad swept hair locks; red tank, open ivory thick jacket shell, folded hood, collar, drawstrings, zipper, pockets, sleeve folds and rolled cuffs, geometric blood stains, tears; dark ragged shorts, belt, buckles and hanging side straps; chunky bare legs, socks, red high tops with toes, soles, treads and laces; individual curled fingers, thumbs, nails, wrist bands.

Geometry uses applied subdivision and smooth normals. All visible static details joined by material within their rigid joint parent. Caps stay attached to proximal parts with zero scale and hidden metadata; restoring unit scale exposes the retained cap. No image textures. Seeded stain outlines, palette token materials, baked unit joint transforms. No skinning.

Reproducibility: sphere meshes are constructed with an explicit ring/face order. Boolean outputs are sorted into canonical coordinate/face order before reduction; deterministic 50 micrometer offsets break equal collapse costs without visible changes. Two fresh full builds produce byte-identical GLBs. Helpers explicitly select their active object before applying transforms. These details are necessary to keep the sculpted, reduced geometry reproducible.

Rebuild all delivery images and GLB:
`python3 experiment/tools/blender_run.py ../assets/inf.screamer assets/inf.screamer/build.py -- --render assets/inf.screamer/renders/hero.png --view deliverables --samples 96 --width 1600 --height 900 --glb assets/inf.screamer/model.glb`

The delivery mode renders front/side/back/three-quarter review views at 960x540/24 samples, the hero at 1600x900/96, and the joint/cap pose at 960x540/24, then assembles the turnaround sheet. The exported rest model is saved before any pose-test rotation.
