# Final review — four rounds

1. Built shell, tiled plinth, doors, pictograms, notice, bin, lanterns, roof equipment and shrubs. First render identified excessive lettering tessellation and a side-heavy camera.
2. Removed font bevels, reduced curve resolution, corrected the camera and wall corner joins, and matched the blue-left/burgundy-right arrangement.
3. Simplified concrete edges and leaf geometry for the orchestrator's 15k cap; removed permanent door backing so the hinged doors reveal the two-room shell.
4. Reviewed final low-cost foliage and the full framing in ref/game renders. Hero render: 1600×900, 96 samples. Game render: 960×540, 24 samples. All modeling/rendering used the required shared Blender runner.

Final exported counts (GLB accessors): LOD0 14,764 triangles/37 draw calls, LOD1 1,918 triangles (~13%)/37 calls, LOD2 524 triangles (~3.5%)/23 total calls, 9 static calls (doors and lamps remain separate). Every LOD retains the root, roof, interior, two door hinge parents, two lamp pivots, light anchors and collider. Static geometry joins by material within the visibility hierarchies. Far LOD omits small weather chips, ground weeds and flower petals.

WebGPU and WebGL2: study/rear/game captures passed with no console warnings, errors or page errors. Surface overlays have physical offsets; no visible z-fighting artifacts in the captures. Door leaf symbols are separate from their surface, weather chips do not overlap each other, and text is extruded. Reference colors, roof silhouette, paired restroom symbols and the central park notice remain clear in the game view. Vegetation and weathering are deliberately simpler than the reference to meet the explicit cap.

All exported positions are finite, no degenerate triangles, no textures, active AO vertex colors on every mesh. Repeated main exports are byte-identical (SHA256 recorded in validation.json). The one-triangle difference from Blender's polygon estimate is exporter tessellation; report.json uses actual GLB triangles. Source reviewed and simplified: direct primitives, eight-face leaves, a single LOD restore helper, no unused modeling helpers. Interior is an unfurnished room shell.
