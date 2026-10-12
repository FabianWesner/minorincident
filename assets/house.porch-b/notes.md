Blue/pink bicycles retain spoke wheels, triangular frames, saddles and handlebars beside the red wagon and red/white ball.

Measured Blender dimensions (metres): [2.4054999351501465, 1.3545000553131104, 1.0859999656677246].

Part list, recipe and dimensions are explicit in build.py; modeling/export helpers are embedded in this self-contained script, using the project sslib for palette/AO. See that collection’s notes.md for exact rebuild/pack/audit commands.


Distance tiers (QA 10-11, FIX-17): `--lod 1|2` rebuilds this script as hard-edged closed solids (no bevels, thicker thin parts, fewer round segments, no micro graphics), never decimation. `python3 tools/blender/run.py assets/house.porch-b/build.py --lod N --glb assets/house.porch-b/model.lodN.glb`, then `npx tsx tools/assets/pack.ts house.porch-b`.
