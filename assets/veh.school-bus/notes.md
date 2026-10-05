# School bus production notes

Reference: supplied reference-upscaled.png. Front is +X, up +Z, metres; four tyres touch z=0. Overall approximately 8.76 × 3.6 × 3.73 m including mirrors. Passenger cabin extends from x=-4.2 to x=2.1, with a short sloped bonnet, five framed side windows, twin folding entry leaves, rounded cap roof, black rub rails, warning lamp pairs, and an octagonal folded STOP paddle.

Details include wheel sidewall rings, tread strips, inset steel wheels, eight vents/lugs per wheel, flared hollow arches, roof seams, rivets, wipers, mirror brackets, hinges, grille bars, marker lights, rear emergency door, and fictional Sunset Grove registration.

Static parts batch by material. Wheels pivot at axle centres; each entry leaf and rear emergency door has its own hinge origin. STOP paddle pivots at its mounting hinge. Lamp lenses remain separate controllable assemblies. Required body/lights/socket nodes and physics/light extras are exported. Tiny markers and warning faces carry decorativeEmissive extras.

Raised marks have geometric separation: rub rails project ~59 mm; side text ~37 mm; window reflections ≥10 mm above glazing; STOP layers have ≥5 mm face gaps and the lettering projects ≥3 mm. No image textures. Studio HDRI is render-only and excluded from the export.

Four review rounds: blockout/detail and initial budget measurement; reduced tessellation, arch trim and hinge refinement; material finish, material batching, deterministic vertex AO and final export; final geometry audit and cleanup. Hero exports are LOD0; --lod 1 and --lod 2 export reduced versions while preserving node hierarchy and joint origins.
