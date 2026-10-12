# Supermarket interior

Reference layout: 8.4 × 9 m cutaway tile slab, two warm tiled walls (3.4 m tall), two center gondolas and one wall gondola, six refrigerated bays, chest freezer, produce endcap, trolley, caution sign, abandoned groceries and blood pools. +X is the open/front side; all contact geometry is above z=0.

The refrigerator doors use lightly tinted scalar-alpha glass over recessed blue interiors, with separate hinge origins. Chest freezer lids use open frames so their stock remains visible at game scale. Checkout equipment is added in the rear aisle per description.txt. Fictional, generic grocery packages have raised labels and price rails; no textures or brands.

Static meshes merge by palette; refrigerator and freezer doors retain hinge origins, cart wheels retain axle origins. Raised graphics are at least 3 mm clear. Tile top is z=0.3575; blood pools start above it. Light and collider contracts export as empty-node extras. Full LOD0 AO is baked into the ao color attribute; LODs inherit the baked attribute.


Distance tiers (QA 10-11, FIX-18): `--lod 1|2` rebuilds this script as hard-edged closed solids (no bevels, thicker thin parts, fewer round segments, no micro graphics), never decimation. `python3 tools/blender/run.py assets/int.supermarket/build.py --lod N --glb assets/int.supermarket/model.lodN.glb`, then `npx tsx tools/assets/pack.ts int.supermarket`. bld.supermarket takes its tiers from these (rerun its build.py and pack it). LOD2 keeps the existing palette folding for the draw-call cap, with woodWarm folded into leatherShadow so shelves stay brown.
