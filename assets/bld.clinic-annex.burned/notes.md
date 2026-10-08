# bld.clinic-annex.burned

Base-owned decay twin (`decayVariants: ["burned"]` on `bld.clinic-annex`): the Sunset Grove Medical Annex after the L1 lab
blast, used from L2 on (campaign continuity, `src/levels/continuity.ts`). Placements opt in with `decay: "burned"`; the
district view draws `bld.clinic-annex.burned` with the base footprint, nodes, pivots and collision.

Built headless from the integrated base exports (`model.glb`, `model.lod1.glb`, `model.lod2.glb`), never re-modelled, so it
reads as the same building at the game camera (shell, name sign and cross, bollards, planters, paving, fence line):

- soot: the base AO vertex colours darken with height and above every opening; flame-tongue soot plumes and a ragged soot band
  under the parapet are explicit overlay polygons on the outer panel faces (readable on the coarse LOD1/LOD2 walls);
- glazing blown out (dark voids), lamp dead, cross unlit and sooted;
- doors blown: right leaf hanging off its hinge, left leaf half open; awning burned off (two sagging charred frame bars);
- roof: a ragged hole over the front-left room with charred joists and a slab sagging into it; LOD1/LOD2 roofs are split into
  a grid around the hole first so the outline matches LOD0; a dark burned-out interior volume behind every opening;
- debris on the lot: rubble heaps under the front window and beside the doors, charred beams, a parapet slab, glass shards,
  scorch fanning out of the doors; planting burned black (LOD0 also loses about half its leaf clusters).

Lights: every `ss_light` anchor is set to intensity 0; the L2 placement also uses an unpowered light group.

Budgets (brief) and result:

| Tier | Triangle budget | Triangles | Runtime bytes (budget) | Draws |
| --- | ---: | ---: | ---: | ---: |
| LOD0 | 100000 | 70895 | 1208508 (1500 KiB hero) | 40 |
| LOD1 | 14400 (`decayAuthoredLodTriangles`) | 12951 | 246624 | 37 |
| LOD2 | 4200 (`decayAuthoredLodTriangles`) | 3946 | 89804 | 28 |

Rebuild: `/Applications/Blender.app/Contents/MacOS/Blender -b --python assets/bld.clinic-annex.burned/build.py`, then
`npm run assets:pack -- bld.clinic-annex` and copy the packed `public/assets/models/bld.clinic-annex.burned*.glb` back over
`assets/bld.clinic-annex/model.burned*.glb` (the committed sources are the optimized exports, like the base). Recipe:
`tools/blender/sslib/clinic_burned.py`. Validate: `npm run assets:validate -- --ids bld.clinic-annex`.

QA: in-game captures at the game camera (near/follow/far) and per-LOD captures are written by
`tests/e2e/levels/continuity.spec.ts` to `test-results/epics/continuity/`.
