# Production review — veh.train-freight

Five visual rounds: initial assembly; warmer paint and front fittings; bevel optimization and non-overlapping wear; broad lower-edge weathering and final studio framing; Three.js AO correction. Final hero: 1600×900, 96 Cycles samples. Game studio view: 960×540, 24 samples.

Reference silhouette and color hierarchy retained: short yellow nose, tall charcoal cab, long vented hood with four fans, red/yellow side bands, yellow railings, dark fuel tank, two locomotive bogies, one ribbed red boxcar with central sliding doors and two bogies. Front plow, lamps, couplers, access steps, springs, horns, seams, abstract placards and offset wear provide purposeful detail. No real railroad marks or image textures.

Static parts join by material. Sixteen wheel pivots, both hinged cab doors, both sliding boxcar doors and front/rear lamp assemblies remain separate. Required vehicle sockets, two physics hull empties, root physics extras and four light anchors are present. Surfaces for paint, markings and plates stand at least 3 mm proud; wear generation rejects overlapping peers. No z-fighting artifacts visible in final WebGPU or WebGL2 game captures.

LOD0: 71,854 triangles, 40 material primitives, 5,425,932 bytes. LOD1: 9,320 triangles (13.0%). LOD2: 2,320 triangles (3.2%). Structural audit passes all three: finite positions, zero degenerate triangles, no textures, all required nodes and 16 wheel pivots. Main, LOD1 and LOD2 renderer runs on both backends have empty console error/warning arrays. Explicit closed LOD forms replace extreme decimation, which proved visually unreliable despite passing the structural audit. AO is baked with 32 Cycles samples and remapped to 0.65–1.0 to avoid black interpolation across large wall faces sampled only at trim-covered corners.

Integration gap: the manifest still contains generic sedan dimensions. Actual game-space dimensions are X 24.748, Y 4.815, Z 3.880 metres. The manifest was not changed because this task permits writes only in the asset directory.
