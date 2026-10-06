# Trimmed hedge

About 2.55 m long, 0.93 m deep and 1.62 m high, within the manifest dimension tolerance.
Rounded box form with soft, clustered leaf blobs, like the bushes in
`initial-drafts/sunset-grove-combat-gameplay-mockup.png`. There are no exposed stems or
planter.

M1 rework (playtest M1-06/M1-07): the old faceted lens leaves read as harsh
triangles with orange (`schoolBusYellow`) shards. The new build places about 77
lumpy leaf clumps with Poisson spacing around a dark inset core. Faces are culled only when they lie well inside a
neighbouring clump (normalised radius² < .70 for LOD0, < .60 for LOD1). This allows for
noise dents and chord sag, so no see-through gaps open. A ray check from the camera
hemisphere finds no back-face-first hits on LOD1 and LOD2, and 1 in 247k rays on LOD0. The clumps are closed ellipsoids, so each colour
change falls where two clumps meet. Vertex normals blend each clump's normal 60/40
with the overall rounded form for soft shading. Three greens are assigned per clump:
`foliageDark` #4a7533 on the low skirt, `foliage` #7da23c on the sides and
`foliageLight` #98b94f on the sunlit crown. Cycles AO (CPU) is baked into the `ao`
vertex colours with its floor lifted to 0.38.

LODs are authored from the same clump layout and fitted to LOD0's bounds.
- LOD0: about 11.6k triangles.
- LOD1 (12-30 m): the clumps merged into 22 larger blobs, about 1.45k triangles (12.5%).
- LOD2: one coarse shell over the clump bumps, banded skirt/sides/crown, about 150 triangles (1.6%).

All tiers use 3 materials (3 draw calls). `prop.tree` uses these exports directly.
`prop.flower` is packed from the same source at 0.25 scale.

Rebuild:
`python3 tools/blender/run.py assets/prop.hedge/build.py --glb assets/prop.hedge/model.glb --lod1 assets/prop.hedge/model.lod1.glb --lod2 assets/prop.hedge/model.lod2.glb --bake-ao`,
then `npm run assets:pack -- prop.hedge` and `npm run assets:optimize -- prop.flower`.
Revert the layout key-order churn that the second command writes.
