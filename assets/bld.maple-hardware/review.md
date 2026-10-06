# Maple Hardware review

Verdict: pass. Five Hero reference/game review rounds. Final hero is 1600×900 at 96 samples; game review is 960×540 at 24 samples.

Reference features retained: wide ochre shop shell, mauve roof with cream/gold coping, three roof plant units, raised Maple Hardware and trade signage, Sunset Grove side mural, crossed tools, warm merchandise displays, hinged entrance, gooseneck lamps, cement sacks, pallets, crates and handcart. Rounded main forms and restrained geometric wear meet the Hero detail bar. No textures or real brands.

Main: 80,288 triangles, 32 draw calls, 4,376,096 bytes. LOD1: 9,531 triangles (11.9%), 20 static draw calls. Authored coarse LOD2: 2,318 triangles (2.9%), 9 static draw calls. Separate door, lamps and wheel pivots, roof and interior controls survive every LOD. Emissive anchors resolve to valid meshes in each file.

WebGPU and WebGL2 load all three files without warnings or errors. Main study/rear/game captures and LOD captures inspected. Three stationary game frames per backend are byte-identical; no temporal flicker observed. Roof coping and wear patches have disjoint footprints, and lettering/plates have physical separation from their supports. GLB audit finds no images, non-finite vertices or degenerate triangles.

Source cleanup: material batching and triangulation cleanup share small helpers; distant geometry is authored directly rather than aggressively decimated. The compact optimizer preserves positions/pivots and exports the baked ao channel as COLOR_0, with soft minimum occlusion. Final main GLB hash matches the backend/flicker-tested file exactly.
