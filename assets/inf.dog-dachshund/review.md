# QA correction review

Removed all dorsal, crown and shoulder spike rows and the long whip-tail with its tuft row. The silhouette now has a continuous smooth back, a short gently upturned tapering tail, hanging floppy ears, long low trunk and short chunky legs. Red collar, tag, glowing red eyes, snarling jaw, teeth, black/tan coat and patchy wounds remain.

Final hero and front renders reviewed against reference-upscaled.png. Hero is 1600×900 at 96 samples. Other turnaround views and the pose test are refreshed to match the corrected geometry.

LOD0: 7,377 exported triangles, below the requested 8,000 limit. LOD1: 2,759 triangles. LOD2: 1,180 triangles. Each has 25 glTF meshes, the same required named nodes and seven hidden stump caps. Applied sculpt smoothing and simplification leave no export modifiers. LODs share the initial grounding pass; maximum exported joint pivot difference is 0.972 mm, within the pipeline's 1 mm contract.

All three exports pass the finite-vertex, naming, palette, hierarchy, hidden-stump and budget audits. WebGPU and WebGL2 captures for every LOD report no warnings or errors. LOD2 intentionally has a coarse distant silhouette. Fur and wound detail remain a simplified geometric interpretation of the reference.

Source cleanup keeps one tail sweep and removes the erroneous fur-ridge loops. Only this asset directory was edited; reference images remain untouched.
