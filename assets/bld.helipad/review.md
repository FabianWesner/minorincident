# Production review

Three Blender reference/game review rounds completed. The production mesh preserves the reference's low square silhouette, sixteen deck panels, segmented concrete edging, two diagonal hazard panels, yellow circular landing marking, white H and four amber Fresnel landing lamps. The raised H and circle read clearly from the game camera. The weathered surface uses seeded, non-overlapping geometric chips, pores, cracks and sparse moss instead of textures.

Round 1 established shape and parts. Round 2 corrected the H orientation, camera framing, overlapping abrasion patches and corner curb seams. Round 3 added curb fixing pores, edge wear and soft lamp glow, and reduced the cool studio fill. The LOD audit subsequently raised the minimum simplification density for the deck panels, thin crack strips, concrete curb and circle to preserve their silhouettes.

Static geometry is joined into seven material meshes. Each of the four lamp assemblies has five material meshes beneath an independently addressable mounting pivot; emissive nodes are linked by ss_light anchors. Open platform: no roof, doors or interior are applicable. The platform collider uses the shared cuboid/size convention. Units are metres, base z=0 and approach +X.

All material names are published palette tokens; Principled scalar materials plus emission, no images. AO is baked into COLOR_0. Paint stands 9 mm above the deck, with wear and crack overlays on separate levels. Side chips stand 4 mm beyond the curb faces. Temporal game-camera checks compare settled frames on WebGPU and WebGL2, alongside visual study and game captures. Numeric results and runtime evidence are recorded in audit.json, browser-audit.json and report.json.


Orchestrator performance QA pass: LOD0 reduced from 97,519 to 19,343 triangles (80.2%) under the requested 20k cap. Sixteen flat deck quads retain the previous expansion-seam widths. The landing ring uses 96 segments; lamp housings use 24–32 segments, lens ribs have no bevel, and small bolts/pores/moss use simple geometry. Static and repeated parts remain merged by material; all node names and mounting pivots are retained.

Regenerated LOD1 is 2,613 triangles (13.5% of optimized LOD0), LOD2 is 1,514 triangles. Fine ribs, pores and wear are omitted at distance; support slabs and key markings retain coherent geometry. The lower LODs have extra depth separation between paint, deck and support layers to prevent precision artifacts at the review viewer's distant camera. Both lower LODs were visually reviewed after this correction.

Final validation: 27 draws, identical node names across all three exports, AO present, no degenerate triangles and no textures. WebGPU and WebGL2 returned zero warnings/errors and identical stationary game-camera frames for every LOD. Updated hero is 1600×900 at 96 samples; game is 960×540 at 24 samples. Before/after main game-camera views preserve the silhouette, colours, markings and weathering; comparison metrics are in optimization-comparison.json. Main geometry stayed identical across final LOD rebuilds. Visual review passed.
