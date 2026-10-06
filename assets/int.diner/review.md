# int.diner visual and technical review

Three rounds: complete furnishing blockout; small-part bevel reduction and enriched kitchen/booth/jukebox details; corrected pass-through/sign spacing and full-cutaway framing. Reference and game views reviewed. The checker floor, three booth groups, five stools, red/cream furnishings, window blinds, Joe's neon, porthole door, kitchen pass-through, clock, town motto and illuminated jukebox are readable.

All graphics are geometry with visible surface clearance. Game and study captures were inspected on WebGPU and WebGL2: no visible z-fighting; no console warnings/errors. Hanging pendants and kitchen door remain separate, with ceiling/hinge pivots. Static meshes are joined by material. Emissive meshes have light anchors, and fixed structural colliders are empty nodes.

LOD0: 96,387 triangles / 37 draw calls. LOD1: 11,375 triangles (11.8%). LOD2: 3,112 triangles (3.2%). All exports have vertex AO, finite positions, required nodes and zero image textures. Roof is intentionally absent in this roofless interior cutaway. The palette's start colors are adjusted slightly for reference red vinyl and cooler chrome.

Remaining visual simplification: framed illustrations and the window landscape use abstract geometry; fine kitchen detailing is reduced. No real brands.

Final hero image reviewed at 1600 × 900, 96 samples; game image at 960 × 540, 24 samples. All three LOD position hashes match the previous build. Final deliverables and browser captures verified.
