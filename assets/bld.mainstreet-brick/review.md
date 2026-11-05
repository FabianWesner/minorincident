# Production review

Passed after four modeling rounds. Front +X, Z up, metres, ground contact z=0. Bakery/pharmacy proportions, brick piers, limestone bands, paired upper windows, striped scalloped awnings, dimensional BAKERY and vertical DRUGS signage, green cross, roof parapet/chimneys/HVAC and sidewalk planting preserve the reference’s main features.

Final hero.png is 1600×900 at 96 Cycles samples. game.png is 960×540 at 24 samples. Final GLB: 95,698 triangles, 26 material/assembly draw calls. LOD1: 13,209 triangles; LOD2: 2,208. Static geometry merges by material while roof, interior and both hinged doors remain independent. Light anchors reference exported emissive nodes; collider is an empty. AO is baked into vertex colours; no images or textures.

Binary GLB validation: finite positions, valid indices, zero degenerate triangles, required nodes, AO attributes and light references pass. Three.js study/rear/game captures load on WebGPU and WebGL2 without console errors or warnings. Three consecutive stationary game-camera frames have identical SHA-256 hashes on each backend: no observed surface flicker. Raised sign and label faces, thick striped fabric, recessed glazing, and offset header-cross bars avoid coplanar details.

Known scope limits: the single reference supplies only front and left elevations; rear/right details are inferred. Interior is a shallow floor/partition/counter shell, not a fully furnished shop. No brands or external font/texture dependencies.
