# bld.gazebo production review

Hero budget override: **20,000 triangles**. Actual exported LOD0 **19,750 triangles / 28 draw calls**; LOD1 **2,404 (12.2%) / 24 calls**; LOD2 **496 (2.5%) / 20 calls**. LOD2 has ten static draws plus ten lamp meshes, within the distant cap excluding animatable lamp nodes. Both LODs use explicit closed simplified geometry; decimation prototypes were rejected after screenshots revealed holes.

Five hero visual rounds: initial full scene; budget experiment; direct geometry simplification; clearer shingles/cupola/flowers; corrected framing and connected flower stalks. Hero is 1600×900 at 96 samples; game is 960×540 at 24 samples. Reviewed against the provided reference and Three.js study/game captures. WebGPU and WebGL2 load all three GLBs with no console errors. No visible coplanar flicker in the final game views. Shingle rows have physical gaps and 6mm offsets; sign lettering clears its face by more than 3mm.

Static geometry is joined per material within root/roof/interior, with transforms baked into vertices. Named lamp spans and park lamp pivots remain separate; ten light anchors reference their emissive meshes. Nine collider empties describe deck and columns. All three models have AO baked into COLOR_0 at 32 samples. No textures, cameras or Blender lights are exported.

The stricter budget prioritizes the octagonal silhouette, shingled roof, cupola lattice, moulded white columns, balustrades, benches, string lights, lanterns and raised Sunset Grove lettering. Foliage uses compact faceted volumes and sparse silhouette leaves. The LODs retain the silhouette, cupola, lamps and sign, with simple closed roofs and paving. Reference images were not modified.
