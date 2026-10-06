# Production review

Three modeling rounds completed. Reference silhouette retained: a straight timber footbridge with five capped newels and two horizontal rail bands per side, separated transverse deck planks, shaded bearers, stone piers and exposed fasteners, crossing a blue-green creek between rocky planted banks. Palette materials only; warm timber, pale approach paving, purple-gray stones and yellow flowering grass. Vegetation and rock facets are deliberately simplified for the Side budget.

Round 1: bridge blockout plus creek dressing, 15,400 triangles; rejected for budget and sparse shoreline.
Round 2: broader vegetation and larger shore rocks, minor-detail simplification, 10,980 triangles; required further budget reduction.
Round 3: explicit eight-triangle flower buds, improved camera alignment, bluer creek and offset rail trim. Final LOD0: 9,828 triangles, 15 draw calls. LOD1: 4,893; LOD2: 2,087. All static meshes batched by material; no animated parts in reference. Root and three cuboid collision anchors verified.

GLB validation: no textures, no non-finite positions, no degenerate triangles, COLOR_0 baked AO on all meshes. Hero render at 1600×900 / 96 samples; game review at 960×540 / 24 samples. WebGPU and WebGL2 study views (35° and 215°) and game captures reviewed; both backends loaded without console warnings or errors. Raised timber grain and water ripples show no visible surface conflict in game captures.
