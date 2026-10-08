# decay.rubble-pile

A low heap of blast/fire debris: plaster and brick lumps, two broken wall slabs, charred beams (LOD0 adds a splinter and a
rebar), scattered bits at the foot. Footprint 2.89 x 1.60 m, 0.69 m high, +X front. Palette only, no textures; fixed physics
(`ss_physics` class fixed, not pushable). Placements add their own blocking collider (layout fallback collider), so the heap
blocks navigation where it lies.

First used by the campaign continuity (src/levels/continuity.ts): debris blown over the Medical Annex forecourt in L2 after
the L1 lab blast. Also the stand-in for the `decay.rubble-pile` entry of specs/05 (L5 devastated twins).

| Tier | Budget | Triangles |
| --- | ---: | ---: |
| LOD0 | 1500 | 524 |
| LOD1 | 600 | 196 |
| LOD2 | 200 | 120 |

End lumps are present at every tier so LOD bounds match LOD0. Rebuild:
`/Applications/Blender.app/Contents/MacOS/Blender -b --python assets/decay.rubble-pile/build.py`, then
`npm run assets:pack -- decay.rubble-pile`. Recipe: `tools/blender/sslib/rubble.py`.
