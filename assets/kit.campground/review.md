# Campground production review

Verdict: PASS for the asset. Five hero/game review rounds, followed by LOD validation.

Reference: `reference-upscaled.png`. Final comparisons: `renders/hero.png`, `renders/game.png`, `renders/three-WebGPU-az35.png`, `renders/three-WebGPU-game.png`, and the corresponding WebGL2 captures.

- Silhouette: both domed tents, open arched entrances, pegged cords, sagging five-bulb light string, A-frame picnic table, stone/log fire ring, and box camper with sloping cab are readable.
- Finish: soft bevels on the hero, seam/pole/zipper details, raised camper stripe and framed windows, roof vents, wipers, mirrors, multi-part wheels, timber planks and bolts.
- Palette: canonical pal_* and emi_* materials; no image textures, brands, or lettering.
- Frame: metres, +X forward, Blender Z up, centered footprint and ground contact.
- Motion: separate axle, door-hinge, suspended-lamp and fire parents. Light extras reference exported emissive mesh names. Collider empties remain non-rendering.
- Surfaces: raised trim and volumetric overlays; no visible surface interference in the final game/backend captures. Distant camper stripes are separated from the door surface and windows retain thickness.
- Geometry: finite positions, zero degenerate triangles in every export, 23,144 hero triangles and 36 total material draws.
- LOD1: 3,222 triangles (13.9%); retain sparse yellow canvas to preserve the canopy.
- LOD2: 872 triangles (3.8%); deliberate solid silhouettes replace destructive automatic collapse. Static material batches remain below the distant draw cap; moving and switchable light nodes stay independent.
- Backend checks: LOD0/LOD1/LOD2 load on both WebGPU and WebGL2 without console errors or warnings.
- Hero: 1600×900 at 96 samples. Game companion: 960×540 at 24 samples.

Repository validation: typecheck and lint pass. Unit tests: 79/80 pass. E17 selected tests: 27/28 pass; both failures identify bld.dugout's missing source-GLB registration, outside this job's folder.
