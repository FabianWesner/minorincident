Wood rocking chair, matching straight chair and three terracotta flower pots form the reference porch dressing module.

Measured Blender dimensions (metres): [1.320361614227295, 2.324185371398926, 1.1405000686645508].

Part list, recipe and dimensions are explicit in build.py; modeling/export helpers are embedded in this self-contained script, using the project sslib for palette/AO. See that collection’s notes.md for exact rebuild/pack/audit commands.


Distance tiers (QA 10-11, FIX-17): `--lod 1|2` rebuilds this script as hard-edged closed solids (no bevels, thicker thin parts, fewer round segments, no micro graphics), never decimation. `python3 tools/blender/run.py assets/house.porch-a/build.py --lod N --glb assets/house.porch-a/model.lodN.glb`, then `npx tsx tools/assets/pack.ts house.porch-a`.
