# Campground production kit

Reference: reference-upscaled.png. Two 2.76 × 2.56 × 2.2 m domed tents, a 4.8 m camper, 2.3 m picnic table, 1.9 m fire ring and a 7.8 m string-light span. Building category; ground contact at zero; entrances and camper face +X. The parts are spaced for the fixed game camera so the fire, table, entrances and van remain distinct.

Purposeful details: arched open tent entrances and zipper rails, pegged guy ropes and sectional poles, rolled sleeping gear, waterproof skirts and vent caps; pegged A-frame table with separate boards and bolts; rounded stones and visible cut log ends; raised roof vents, sloping windscreen, wipers, framed side windows, mirrors, grille, raised orange trim, wheel arch lips, tread blocks and wheel hubs; hanging bulb pivots and light extras. No brands or textures. All trim is volumetric and stands clear of its backing. Fine colour differences stay within the palette.

Static meshes join by palette; doors and wheels batch within hinge/axle parents. Lamps retain suspension pivots. Fire tongues retain an independent parent. Colliders are empties. AO uses 32 deterministic visibility rays. LOD1 drops tiny fasteners and seams before decimation, retaining the sparse yellow canvas. LOD2 rebuilds deliberate solid silhouettes with raised volumetric van trim. Both regenerate from build.py and retain motion/light nodes.

Repository checks: typecheck and lint pass. Unit checks (79/80) and E17 checks (27/28 selected) encounter the existing bld.dugout source registration failure. No repository registration changes are made by this folder-scoped production job.

## Art registration (2026-10-07)

Measured delivered bounds (X/Y/Z, metres): 8.5196, 3.4915, 9.0075. Source, named pivots/sockets, palette, front marker and delivered tiers are validated by the production validator. Runtime status is integrated. Five-angle LOD contact evidence: `test-results/art-register/kit.campground/lod-contact.png`.
