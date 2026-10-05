# Infected Sprinter

Reference: purple six-panel cap with peak and star patch, brown swept hair, ivory torn hoodie and hood, red undershirt, charcoal athletic shorts, ribbed socks and red high-top sneakers. Adult infected chibi silhouette matches accepted common-worker: head and cap about one third of total height, forward lean, bent knees and enlarged claws. +X forward, -Y right, feet on Z=0. Rigid joint empties own merged palette geometry. Subdivision is applied before export. Purple asphalt and dark woodWarm are reference-specific palette variants. Stump caps use zero scale and hidden extras; restore scale to reveal.

No textures. Cloth shells, thickness, layered cuffs and soles, individual teeth/fingers, curved peaked visor and six cap seams. Deterministic seed 71.

Review round 1: 61,060 tris; outfit reads, brim obscures eyes, laces buried. Round 2: 41,018 tris; lifted brim and neutral head tilt reveal eyes, staggered knees and sneaker seams improved. Round 3: folded rear hood, repositioned tongue/laces, golden star and cap/cuff blood; reducible-geometry budget targets 38,500 tris.

Round 4: warm emissive eye centers replace shaded white dots; pose camera switches to the left side to expose stump_armL. Removed redundant initial decimation: one calculated budget pass now preserves detail while staying under 40k.

Final source review: one budget pass retained; experimental canonicalization removed after it failed to make Blender Decimate byte-deterministic. Rebuild counts agree, but exact indexed geometry can differ on symmetric forms. This is recorded as a limitation.
