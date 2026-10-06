# Delivery driver hero
Reference: blue short-sleeve uniform and cap, chunky brown cargo pants with open knees, dark high-top trainers with red laces, yellow pizza delivery parcel. Hair brown and volumetric; adult angry face and glowing red eyes. Large head about one third of height. Rigid procedural hierarchy, translation-only rest pivots, torso-parented parcel and straps. Applied organic subdivision, per-part material batching, hidden stump caps attached to the surviving parent. No image textures.

Final frame: Blender +X forward, +Z up, -Y character right; GLB converts to Y up. Height 1.689 m. 38,466 triangles across 74 meshes; face and stump caps are preserved during the applied tessellation reduction. All modifiers are applied before export. Stump caps remain enclosed in the intact character, hide in Blender renders, and export `hidden` / `ss_hidden` extras for the runtime to honour. The caps stay on the surviving parent when their corresponding limb detaches.

Final simplification: shared one surface-projection helper for skin, cloth and cap relief; merged decorations by material within each rigid joint; kept no textures, armature, speculative variant system or external modelling dependency. Cleaned zero-area mesh faces before export. The cap emblem uses a small triangular grid because a single planar triangle cuts through a curved crown.

Reproduce the entire final delivery render pass:
`python3 experiment/tools/blender_run.py ../assets/inf.delivery-driver assets/inf.delivery-driver/build.py -- --render assets/inf.delivery-driver/renders/hero.png --view final --samples 96 --width 1600 --height 900 --glb assets/inf.delivery-driver/model.glb`
The final view renders the hero at 96 samples, four 960x540 review views at 24 samples and a 1600x900 pose test at 24 samples. Run `python3 assets/inf.delivery-driver/compose.py` to assemble the turnaround and reference comparison.

Rebuild comparison: all 74 named meshes match within 0.000164 mm. Decimation preserves all skin, shoes and standalone objects, and uses canonical vertex/face order for the larger joined meshes. glTF export still introduces sub-micrometre rounding variation; exact quantized hashes can differ at rounding boundaries. See `determinism.json`; byte-identical rebuilds are not claimed.

## M1 crown coverage (2026-10-06)

Corrected inward cap winding; closed the cap crown. Joint pivots, attachment sockets and rig hierarchy are retained. LOD0/1/2: 38,474 / 5,854 / 1,698 triangles. Distant geometry omits fine trim and retains coarse geometry for every required source contract node.

Rebuild hero through `experiment/tools/blender_run.py` with `--glb assets/inf.delivery-driver/model.glb`, then `npm run assets:pack -- inf.delivery-driver`. For authored LOD2, build with `--lod2 --glb .cache/m1-art/driver-lod2.glb`, then run `npx tsx assets/char.survivor-female/pack-lod2.ts` after building all three edited humanoids. Do not use `--regenerate` after producing the authored tiers. Delivery-driver crowd geometry is rebaked from LOD1.

Regression: `npx tsx assets/char.survivor-female/scalp-regression.ts` casts exterior, backface-culling crown and rear rays against all 15 L1 humanoids and all three tiers. Before: exposed crowns on female survivor, civilian-man-a and delivery-driver. After: all 45 tier checks pass. Other audited humanoids needed no source edits. Desktop/iPhone game-camera and rear-view renders are reviewed then deleted.
