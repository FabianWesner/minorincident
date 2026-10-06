# Plank stack

QA reduction for repeated E26 barricade material: LOD0 is 2,412 triangles (formerly 11,964), with three draw calls. Fifteen staggered boards use one-segment bevels; all per-grain, end-grain overlay and knot geometry is removed. The warm timber, darker end-grain and golden bindings retain the palette. End-grain colour is assigned to existing faces. Binding paths have 36 samples and four-sided strands with only six twists per loop.

All original names remain: root, body, timberGrain (now coloured timber end faces), ropeGold, front and col:bundle. Static geometry is joined by material. No textures or coplanar overlays. Heavy movable barricade physics extras and baked AO remain. Blender +X forward, Z-up; ground contact normalized to z=0.

Reproducible lower levels use build.py --lod 1 or --lod 2: unbeveled boards and single low-segment binding tubes. Exports are model.lod1.glb and model.lod2.glb. LOD0 remains model.glb.

LOD0 measured dimensions: 2.684 × 0.968 × 0.728 metres (Blender X/Y/Z). Manifest dimensions remain the generic 1 m placeholder and should be updated during integration; no manifest edits were made in this asset-only job.

WebGPU and WebGL2 study/game captures loaded the reduced GLB without console warnings or errors. Individual courses, staggered ends and both bindings read clearly in the game view.

Final reduced hero re-rendered at 1600 × 900 / 96 samples and game view at 960 × 540 / 24 samples; both visually reviewed. LOD1: 780 triangles; LOD2: 460. Both lower levels also pass WebGPU/WebGL2 without warnings or errors.
