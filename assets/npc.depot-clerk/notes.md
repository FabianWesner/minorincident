# npc.depot-clerk modeling notes

Reference: original front/back crop from initial-drafts/l1v2-neighborhood-kit-2.png and the built-in imagegen clean upscale. Prompts and crop coordinates are retained locally in this folder. Chestnut high bun, round dark spectacles, ear pencil, ivory/brick striped blouse, teal bib apron and pocket, crossed rear straps and waist bow, cuffed denim, wristwatch and ivory/brick sneakers.

Adult chibi, approximately 1.4 m tall including hair; broad head, chunky hands and shoes. Blender +X forward, -Y right, +Z up; glTF +X forward, +Y up. Final glTF bounds in metres: x=0.4631, y=1.4237, z=0.7504. All colors read existing src/assets/palette.json tokens; no palette additions, image textures, skinning or brand artwork. The build copies the accepted civilian rigid-joint hierarchy and sculpted loft/lock helper pattern, with one self-contained script per asset.

Coat skirts, apron and their decoration belong to the torso. Sleeves, forearms, hands, legs and shoes retain their separate joint pivots. Static meshes join only by owner/material. Reference accessories remain attached to their matching rigid joints. The source is deterministic; a second build gave the same raw geometry hash. CPU Cycles AO uses 32 samples and seed 17 and exports active COLOR_0. Studio lights, camera and floor never export.

Rebuild raw hero through the required wrapper:

```sh
python3 experiment/tools/blender_run.py ../assets/npc.depot-clerk assets/npc.depot-clerk/build.py -- --glb assets/npc.depot-clerk/model.raw.glb
python3 experiment/tools/blender_run.py ../assets/npc.depot-clerk assets/npc.depot-clerk/build.py -- --quality lod2 --glb assets/npc.depot-clerk/model.lod2.raw.glb
```

Run `npx tsx assets/npc.depot-clerk/pack.ts` after the two raw builds to reproduce all three compressed files. The packing script uses the shared tools/assets/optimize.ts optimizeAsset function: raw hero → model.glb at ratio 1; raw hero → model.lod1.glb at ratio 0.10; authored distant raw → model.lod2.glb at ratio 0.65. Use this asset's character contract with tier hero, sourceForward +X, sourceScale 1 and the measured bounds above while packing workspace sources. Quantization is 16-bit positions, 8-bit normals/colors plus meshopt. LOD2 records authoredLod=2 and deliveryLodGenerated=false so the integrator preserves its authored silhouette. Stitches, net lattice, individual fingers and shoe ornaments are omitted only on the distant tier; all required pivots, skin and pupil tags survive.

The integrator owns manifest changes and public runtime exports. Lab-tech-b, lab-guard and depot-clerk currently have side-tier placeholder entries; they require hero tier to match this request and its 1.5 MB size budget. No manifest, shared code, other assets or protected references were edited, and no commit was created.
