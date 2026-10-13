L9-S3 terrain review, 2026-10-13. Opened both overview sheets: four areas (fork, countryside, dry shortcut, road seam), high/low quality, zoom 1.0/0.5, on actual WebGL and WebGPU. These compare the retained D1 greybox with its streamed representation; they assess terrain and the healthy APC, not the complete E31 combat/HUD/crash vision criterion.

PASS — A camera/proportions: the isometric lens retains the chunky unarmed APC silhouette. Vehicle-focused Scene Lab cameras now include the game's 15% driving pull-back, so the closest zoom preserves the bumper inside the frame. Headlights and the yellow navigation ring remain distinct in both tiers.

PASS — A palette/shadows: cool blue road, brown countryside track, muted dry terrain and green verges remain distinguishable under the retained dry-night preset. Shadows stay blue-purple. The low tier preserves the same road layout and vehicle shape as high; no default-gray fallback asset appears.

PASS — terrain seams/support: the road stripe and ground continue through x=0; no crack, missing tile or visible height jump appears in either backend. The vehicle wheels remain seated on the surface throughout the Scene Lab sequences. Automated side-to-side/coarse-to-detail samples constrain heights to 2 cm; wheel sink/float/spike gates pass in all 32 matrix cases.

PASS — scoped D/G readability: the healthy APC, headlights and route surfaces are immediately identifiable at both zooms. The close views retain the star, windows, wheels and material separation. The lighting remains consistent between backends and tiers. The terrain review is 8/10 with no terrain P0/P1. D combat telegraphs/threats, F HUD and damage/floor/crash lighting are not assessed by these isolated terrain scenes; their systems and QA lanes remain required for the full epic.

PASS — unload/reload pair: [seam pair](seam-pair.png) preserves the courier/APC placement and the road/grass boundary at the same camera in both tiers. The automated fixture also asserts the retained corpse ID/health and unchanged vehicle ID/HP, independently of its camera occlusion.

Evidence: [WebGL matrix](matrix-webgl.png), [WebGPU matrix](matrix-webgpu.png), matrix results and game-camera seam before/after captures under `test-results/epics/E31/l9-stream/`. Matrix JSON records the actual backend rather than inferring it from the requested backend.

Rebuild terrain derivatives with `npx tsx tools/l9/build-terrain.ts` after rebuilding D-CROSSING's authored layout. The exporter leaves the retained base GLB/layout untouched, emits 96 local cell assets (largest 168 triangles) and a 5,325-triangle coarse horizon. Palette materials and terrain batches use the existing district cache and GPU warm-up path.
