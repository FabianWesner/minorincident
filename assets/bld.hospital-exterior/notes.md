# Hospital exterior

Reference-derived composition: 17 m wide, 7.5 m deep, three-storey 9.5 m hospital; taller central cross risalit, broad left name panel and projecting 11.5 m emergency canopy. White masonry, teal glazing frames, red signs, amber lit windows. Includes individual window cases, mullions, canopy pavers, column courses, mechanical rooftop units, pipework, entry planters, curb blocks, branched trees, flowers and freestanding directory. +X entrance; base rests at Z=0. Door origins are at outer hinges. Roof assembly hides rooftop equipment and canopy together. All lettering is mesh geometry with positive surface clearance. No image textures or real brands.

LODs use explicit architecture instead of collapse decimation, which removed faces from disconnected beveled parts. LOD1 keeps flat hospital and emergency lettering, framed panes and closed volumes. LOD2 keeps the red cross, canopy, columns, rooftop plant, window rhythm and broad tree clumps, with neutral trim materials consolidated to seven tokens. Roof and door assemblies and light/collider anchors remain named.

The game-camera depth check required wider standoff spacing on signs and markings, hollow window rims with separate panes, and removal of the canopy tile underlay. Closed materials use backface culling. Sparse surface scuffs replace the reference's dense painted wear.
