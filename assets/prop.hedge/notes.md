# Trimmed hedge

Reference proportions interpreted as 2.4 m long, 0.84 m deep, approximately 1.55 m high. Dense rectangular crown, vertical sides, softened irregular leaf perimeter. No exposed stems, planter or additional props.

684 closed eight-sided rounded leaves form overlapping courses on four sides and the crown. Smooth normals and two greens replace the hard triangular ridges and yellow shards. Two static palette meshes; a broadly bevelled inset green core conceals gaps. Authored distant tiers use overlapping rounded foliage masses. All geometry rests at z=0 after ground normalization. No moving parts or light anchors are relevant. Root and cuboid collider are exported as empties.

Every static mesh has a Cycles ambient-occlusion bake at 32 samples in the `ao` vertex-color attribute. No image textures are exported.

Three review rounds: blockout/density; staggered courses, varied normals and reference camera; thinner leaf lenses, camera margin and geometric AO. Build script uses direct mesh arrays rather than hundreds of individual objects or modifiers.

## M1 hedge feedback (2026-10-06)

LOD0/1/2: 11,244 / 1,260 / 300 triangles, within specs/03 §7. The existing `col:hedge` metadata is retained; D-RES/D-MAIN use placement anchors, with no embedded hedge geometry to patch. Desktop game-camera and iPhone portrait comparison reviewed against the gameplay mockup: rounded leafy green bushes, no orange shards. Temporary review renders are deleted after inspection.

Rebuild each source tier via the shared CPU Blender wrapper: `build.py --glb model.glb`, `build.py --lod 1 --glb model.lod1.glb`, `build.py --lod 2 --glb model.lod2.glb`; then `npm run assets:pack -- prop.hedge` (retain authored tiers). Regression: `npx tsx assets/prop.hedge/foliage-regression.ts`.
