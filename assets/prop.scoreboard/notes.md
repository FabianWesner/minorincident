# Scoreboard production notes

Reference proportions: board approximately 4 m wide; total height 4.25 m; twin posts, concrete footings, diagonal braces, arched header and baseball crest. Face is +X, contact plane Z=0.

Raised cream Rockwell lettering and individual emissive amber bulb digits reproduce SUNSET GROVE / HOME / GUEST / INNING, home 03, guest 02, inning 4. Material identities use canonical palette tokens; backpackTeal substitutes for the reference's dark forest-green painted wood. Gold edges use schoolBusYellow and exposed timber woodWarm. No image textures.

All trim, labels, bulbs and weathering have physical depth and clearance. Static geometry is joined by material; no mechanical animated parts. Bulb mesh is marked decorativeEmissive, so it introduces no dynamic light cost. Root/body and collider metadata remain separate nodes. Deterministic Cycles vertex AO is baked through the shared library.

## Art registration (2026-10-07)

Measured delivered bounds (X/Y/Z, metres): 0.6514, 4.2682, 4.19. Source, named pivots/sockets, palette, front marker and delivered tiers are validated by the production validator. Runtime status is integrated. Five-angle LOD contact evidence: `test-results/art-register/prop.scoreboard/lod-contact.png`.
