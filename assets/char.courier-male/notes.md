# Courier hero outfit

The Level 1 CHAR.COURIER-OUTFIT panel is the outfit design authority. Body, face, hands, joint pivots and sockets are reused from the current read-only char.survivor-male source. The female retains the Opus 3.4-head re-proportioning. Orange short-sleeve polo/tee, khaki cargo shorts, white socks/sneakers with orange accents, teal wristbands, a medical-cross cap and a teal messenger bag define the outfit.

Cap, scalp, retained hair, ears, eyes, brows, nose and mouth all belong to head. The male neck was reparented from torso to head without moving it. The cap has a closed dome, raised seams, visor, top button, cross and a back adjustment opening. The female ponytail exits behind the cap. The messenger bag is a rigid child of the original backpackSocket; the diagonal strap belongs to torso. These attachments can carry over to a future skinned skeleton. All materials use canonical src/assets/palette.json tokens and are single-sided. Raised graphics stand at least 4 mm proud.

Rebuild through the required runner only:

```sh
python3 experiment/tools/blender_run.py ../assets/char.courier-male assets/char.courier-male/build.py -- --glb assets/char.courier-male/model.raw.glb --lod1 assets/char.courier-male/model.lod1.raw.glb --lod2 assets/char.courier-male/model.lod2.raw.glb --render assets/char.courier-male/renders/final.png --view all --width 1600 --height 900 --samples 96
npx tsx assets/char.courier-female/pack.ts male
sh tools/e2e-lock.sh node assets/char.courier-female/capture.mjs
```

CPU Cycles AO uses 32 samples and seed 17; visual review uses Eevee. Packing invokes the project's optimizer, quantization and meshopt functions without editing the manifest or runtime paths. LODs keep the full joint/socket hierarchy. Raw exports are temporary; model.glb/model.lod1.glb/model.lod2.glb are the delivery artifacts. WebGPU is reserved for manual checking as required by repository guidance.

LOD1 and LOD2 are authored as closed silhouette proxies on the exact original rig. The initial generic simplification/collapse preserved numeric budgets but visibly tore thin garment/decal shells with backface culling; those results were discarded. LOD1 retains facial relief, fingers as a hand volume, cap cross, hair/ponytail, cargo pockets and bag/strap. LOD2 reduces these to broad closed color blocks. Both tiers use the project's quantization and meshopt compression, retain every joint and socket, and bake deterministic AO.
