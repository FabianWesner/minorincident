# Production review

Five visual rounds: initial reference pass; hollow-head and framing correction; unioned smoke; smoke density check; final density and clearance pass. The reference silhouette, body proportions, grey shell, broad yellow band, machined head, hollow opening, side vent, retaining plate and hanging pull ring read in the game view. No visible lettering or real brands were added.

Final: 11,887 triangles, eight mesh draws, seven existing palette materials. Fixed geometry is joined by material. Pull ring has its pivot at the pin joint; smoke is separate, removable and anchored at smokeEmitter. Mesh smoke replaces the reference's soft volumetric cloud under the texture-free GLB constraint; runtime particle animation is outside this asset.

Validation: finite positions, zero degenerate triangles, no image textures, expected node names and physics extras. Two independent builds have identical SHA-256 hashes. WebGPU and WebGL2 captures have zero console errors/warnings. Repeated game-camera screenshots are byte-identical on both backends, with no observed stripe or chip flicker. Triangle-fan cap cleanup preserves the already-reviewed flat surfaces.

Final hero is 1600 x 900 at 96 samples; game is 960 x 540 at 24 samples. Shared palette/AO helpers and small geometry helpers keep the build script self-contained and reproducible. No changes outside the asset directory.
