# veh.helicopter review

Five rounds completed. Final hero: 1600×900, 96 Cycles samples. Game: 960×540, 24 samples.

The red/ivory rounded rescue airframe, four main rotor blades with red tips, four-blade tail rotor, skids, roof beacon, nose searchlight, cross/RESCUE marking, N472RE registration and fictional feather emblem match the reference design. Soft bevels, grilles, mast hardware, exhausts, steps, handles, hinges and skid saddles supply the Hero detail.

Final GLB: 62,136 triangles, 39 material primitives. LOD1: 7,423 triangles (11.95%). LOD2: 1,749 triangles (2.81%). All required nodes and separate motion pivots survive the exports. Vertex AO is explicitly exported as COLOR_0. No textures, non-finite attributes or degenerate triangles.

Final Three.js study and gameplay captures load on WebGPU and WebGL2 without console errors. Initial distant depth flicker was resolved by increasing physical separation between glazing/paint layers; final game captures show stable windows and markings.

Known difference: glazing is opaque and there is no cabin interior. Town branding remains fictional. The manifest’s generic car dimensions require a separate integration update; actual game-space bounds are 11.087 × 4.512 × 9.663 m.
