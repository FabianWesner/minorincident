Half-raised sectional door exposes the lower storage area while retaining identical frame/slab dimensions.

Measured Blender dimensions (metres): [1.287731647491455, 2.724468946456909, 2.3400001525878906].

Part list, recipe and dimensions are explicit in build.py; modeling/export helpers are embedded in this self-contained script, using the project sslib for palette/AO. See that collection’s notes.md for exact rebuild/pack/audit commands.

Distance tiers (QA 10-11, FIX-16): `--lod 1|2` rebuilds this script with hard-edged boxes, fewer weed leaves and no trim/fine dressing, keeping every door panel and raised panel (no decimation, which skewed the door and added wedges). `python3 tools/blender/run.py assets/house.garage.<state>/build.py --lod 2 --glb assets/house.garage.<state>/model.lod2.glb`, then `npx tsx tools/assets/pack.ts house.garage.<state>`.
