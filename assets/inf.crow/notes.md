# Infected crow — flock-budget revision

LOD0: 2,442 exported triangles (35 meshes), reduced from 38,620. Crows are flock animals, so the revised animal budget is 3,000 triangles. The lower LODs are regenerated locally as model.lod1.glb and model.lod2.glb; exported counts are 754 and 400 triangles, respectively (also recorded in their validation JSON files).

Geometry: three closed planes-with-thickness per wing (root, ragged flight fan, outer band), one closed saw-toothed tail fan, a chunky crown and cheek/chest shells. Body/head/eyes use eight-segment, four-ring spheres without subdivision. Beak, legs and curled talons use low-segment tubes. Fine coverts, quills, scales, knuckles and skin slivers were removed. No image textures or live modifiers are exported.

Preserved: raised wing silhouette, oversized crow head, hooked open beak, emissive red eyes, red flank wounds, curled claws and palette names. +X forward, +Z up, -Y character right; feet meet z=0. Bird nodes and infected compatibility joints/stumps retain their names and shoulder/elbow/hip/knee/ankle pivots. The wing fan follows foreArm and its outer band follows hand; the entire assembly still flaps through wingL/R or armL/R.

Rebuild through experiment/tools/blender_run.py, adding --lod 1 or --lod 2 for the regenerated lower LODs. Eye glow/core and eight-triangle stump caps remain protected from LOD decimation. Geometry merges only within the same rigid joint/material. Final renders and validation accompany the model.
