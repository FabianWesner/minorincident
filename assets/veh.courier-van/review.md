# Courier van production review

Pass: four review rounds, including the LOD review.

1. Established the high-roof panel van silhouette, real wheel arches, steel wheels, open rack and raised medical markings.
2. Darkened the rack, strengthened typography, opened the windshield backing and closed the front roof gap.
3. Extended the teal stripe onto the front fenders, enlarged lamps/lettering, closed the rear header gap, and moved the tail-lamp wrap 30 mm clear of the stripe.
4. Replaced damaged automatic LOD reductions with authored primitive variants. LOD1 keeps text and curved wheels; LOD2 retains the van silhouette, roof rack, glazing, teal stripe and medical crosses with simple wheels and fewer fittings.

LOD0: 71,990 triangles, 38 draws. LOD1: 8,372 triangles (11.6%), 38 draws. LOD2: 2,360 triangles (3.3%), 37 draws. Static geometry is merged by palette material; animated wheels, cab doors, sliding cargo door, rear doors and lamps retain separate joint origins. Static draws remain within all tier caps.

Final hero: 1600 × 900, 96 samples. Game: 960 × 540, 24 samples. Reference and game captures reviewed in all three hero rounds. Three.js front/rear study and game captures, plus an azimuth 43°/45°/47° surface sweep, show clean markings and no visible z-fighting. WebGPU and WebGL2 load all three LODs with no console errors.

GLB checks: required nodes and animation children, finite vertices/normals/colors, nondegenerate triangles, baked AO, no image textures, collider metadata and image dimensions pass. Palette and emission names use the defined tokens. +X forward, metres, grounded at z=0. Generic geometric grille badge; fictional Sunset Grove text; no real brands.

The build shares one geometry recipe across detail levels; standard letter geometry is loaded once. Reference images and other asset directories are untouched. No known gaps.
