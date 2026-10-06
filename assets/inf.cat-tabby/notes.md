# Tabby infected cat
Reference: orange/cream arched quadruped, angry red eyes, broad hissing muzzle,
notched right ear, curled ringed tail, dark tabby stripes, pink ragged bald patches.
Approximately 0.85 m at the back/ears, 1.35 m nose to rump; tail rises to 1.1 m.
The oversized head is roughly one third of the standing body height. No clothing.
Quadruped hierarchy plus infected compatibility nodes: front upper/lower limbs are
arm/foreArm, rear upper/lower limbs leg/shin. Stump caps live on proximal parents,
exported at zero scale with hidden/stumpFor extras. Restore scale to show caps.
All Catmull-Clark surfaces are applied before export. Materials use named palette
colors; orange uses corgiOrange and woodWarm. Geometry is deterministic.

Measured final GLB bounds in game (+Y-up) coordinates: X=1.746 m, Y=1.103 m,
Z=0.740 m, including tail and whiskers. The existing manifest uses generic
infected placeholder dimensions (0.7, 1.6, 0.6); reconcile those at integration.
This asset-only job does not edit the manifest.

Animal budget revision: LOD0 ≤8,000 triangles. Outputs: model.glb (7,342),
model.lod1.glb (2,790), model.lod2.glb (1,144). Rebuild with --lod 0|1|2;
the same names, pivots, hierarchy and 11 stump-cap meshes are retained.
