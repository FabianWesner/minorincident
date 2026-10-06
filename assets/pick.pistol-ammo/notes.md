# Pistol ammunition pickup — ground-pickup performance revision

The open olive reference case remains 0.32 × 0.60 metres, rests on z=0 and faces +X. Its recessed lid opens 108 degrees around the rear Y hinge. The folding end handle retains its hinge pivot.

LOD0 now uses three merged brass bundles with nine broad six-sided copper tips, simple hollow walls and rolled rails, corner guards, a recessed lid, two hinges and an open handle. Fine wear chips, rivets and cartridge rims were removed. Static geometry joins by material; lid and handle remain independent assemblies. All original node names are preserved; material-group names without remaining geometry are empty anchors.

Budget override: ≤2,500 triangles, ≤6 draw calls. Actual LOD0: 1,016 triangles / 6 calls. LOD1: 508 triangles / 6 calls. LOD2: 250 triangles / 6 calls. Every `--glb model.glb` export also regenerates `model.lod1.glb` and `model.lod2.glb`, using deterministic Blender decimation while retaining the scene hierarchy.

Texture-free Principled palette materials; baked corner AO. Olive/brass/copper colour separation and open-case silhouette take priority over individual ammunition detail. No reference images or manifest entries changed.
