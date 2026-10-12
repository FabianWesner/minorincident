# acc.hat-bucket-hat

Crowd accessory (hat) for the shared civilian rig; PO 2026-10-12 "more variants: different hair cut/color, hats". Built by `build.py` via `tools/blender/sslib/accessory_set.py`.

- Geometry is exported in head-joint-local source metres (Blender +X forward, Z up) under `root > head > body`; the runtime parents it to the base's `head` node and applies `accessory.fits[<base id>]` from the manifest (scale about the head node, then offset; glTF Y-up, base source metres before `sourceScale`).
- One neutral material (pal_picketWhite) plus a baked vertex-colour form shade; the system lane tints it per instance.
- Triangles: LOD0 <= 150, LOD1 <= 80, LOD2 dropped (no lod2 file, no `lods.lod2` in the manifest).
- Bases that already wear headwear (`npc.civilian-man-b` cap, `npc.civilian-elderly` flat cap, `npc.civilian-woman-b` bun) carry `hasHeadwear: true`: hide the base headwear or skip them.
- Fits: `python3 tools/blender/run.py tools/blender/accessory_qa.py --fits`; sheets and skull-clip metrics: `python3 tools/blender/run.py tools/blender/accessory_qa.py --render -- --sheets <dir>`.
- Rebuild: `python3 tools/blender/run.py assets/acc.hat-bucket-hat/build.py`, then `npm run assets:pack -- acc.hat-bucket-hat`.
