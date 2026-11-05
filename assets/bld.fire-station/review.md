# Asset review — bld.fire-station

Visual review: Codex. Five reference refinement rounds, followed by export/LOD technical QA.

The final hero retains the reference's two red sectional bays, red brick and cream masonry, readable SUNSET GROVE / FIRE DEPT sign and crest, open bell tower with golden bell, orange/slate tiled hip roof, rooftop HVAC units, lit side window, wall lamps, bollards, civic flag, planted edges, and yellow apron markings. Both game-camera backends preserve the main station silhouette and bay/sign identity.

Final meshes: LOD0 53,422 triangles / 40 draws; LOD1 7,991 triangles / 38 draws (14.96%); LOD2 1,881 triangles / 26 draws (3.52%). Static draws are 18 / 16 / 12 respectively; the remaining draws belong to separate animated assemblies. The orchestrator's 60,000-triangle cap and category draw caps pass.

Geometry QA: finite positions, zero degenerate triangles, no image textures, baked COLOR_0 AO, palette-only Principled materials, required root and functional nodes on all LODs. The two garage doors pivot at their top roller joints, personnel door at its hinge, bell at its suspension, and lamps at their wall mounts. Roof/interior are distinct groups. Colliders and light anchors export as extras.

Marking QA: lettering is 13 mm beyond the sign face; paint-guide top faces are 20 mm above pavers; garage glazing/frames/reflections have separate exposed depth layers. The two sandstone trim blocks that obstructed SUNSET were removed. The final Three.js study/game captures show clean markings with no visible z-fighting. Both WebGPU and WebGL2 load all three LODs with no console warnings or errors. Solid LOD construction replaces the fragmented output of blanket detail-mesh decimation.

Source was simplified by batching bricks directly by material, sharing the mesh merge and light-reference functions, removing redundant filters/material setup, and using unmodified closed solids for LODs. References and all files outside this asset folder remain untouched by asset edits.

Integration gap: the full-size reference-derived footprint differs from the existing placeholder manifest dimensions. The manifest and runtime registry were deliberately left for the integrating job under the asset-only work restriction.
