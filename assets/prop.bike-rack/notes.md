# Bike rack modeling notes

Source crop: initial-drafts/l1v2-neighborhood-kit.png, pixel bounds [865, 647, 1153, 824]. Built-in imagegen edit, one attempt; prompt.md records it.

Exactly three silver inverted-U parking loops on a pale rectangular paver base, six blue-gray circular mounting flanges and anchor bolts. The tubes have a fixed plane normal throughout the sweep so the rounded corners have no ring twists. silver, denim and sidewalk are shared palette tokens; silver uses metallic = 0.65 and roughness = 0.3. No textures.

Blender +X front / +Z up. The rack's long axis is Blender Y / glTF Z. Three named slot1/slot2/slot3 empties are at Blender Y = -0.8/0/+0.8 m. Each slot has a separate fixed collider; col:base encloses the foundation. Base measures 1.256 × 2.4 × 0.17 m in Blender XYZ; overall height roughly 1.042 m. Exact glTF bounds and nodes are in validation.json.

LOD1 uses eight-sided tubes with fewer bend rings, a complete closed slab and mounting feet. LOD2 uses four-sided tubes with three steps per corner and a closed slab. Both preserve all three slots; details fade rather than leaving holes in the slab. CPU AO is baked separately for each tier. Material groups merge into at most three draws per tier.

Reproduce:

```sh
python3 experiment/tools/blender_run.py ../assets/prop.bike-rack assets/prop.bike-rack/build.py -- --glb assets/prop.bike-rack/model.glb --render assets/prop.bike-rack/renders/game.png --view game
npx tsx assets/prop.bike-rack/pack.ts
```

pack.ts uses the existing project optimizer and only writes this directory. Runtime registration belongs to the integrator.
