# Pharmacy / clinic production model

Reference layout is a 6.25 m square cutaway tile plinth, 3.6 m cornice,
rear pharmacy shelves, framed shop glazing and paired doors, right care-message
wing, four blue waiting seats, wheelchair, entrance plant and A-frame flu sign.
The named front is +X; Blender Z is up; bottom of foundation is z=0.

Purposeful additions behind the shopfront: prescription counter with register,
three cabinet doors, paper pad, and examination couch/step in the consultation
alcove. No real brands. All printed marks are geometry and stand at least 3 mm
proud; the floor splatter stands 40 mm above the tiles. Tile and masonry seams
are actual gaps. No image textures. Static meshes join by palette material;
shop doors and wheelchair wheels retain joint empties and their own meshes.

The final layout mirrors the authored Y positions to show the glazed side to
Three.js' fixed +X/-Y study/game camera. Lettering is transformed independently
so it remains readable. The counter sits behind the display shelving, and the
consultation couch occupies the alcove behind the care-message wall.


Distance tiers (QA 10-11, FIX-18): `--lod 1|2` rebuilds this script as hard-edged closed solids (no bevels, thicker thin parts, fewer round segments, no micro graphics), never decimation. `python3 tools/blender/run.py assets/int.pharmacy-clinic/build.py --lod N --glb assets/int.pharmacy-clinic/model.lodN.glb`, then `npx tsx tools/assets/pack.ts int.pharmacy-clinic`. bld.pharmacy takes its tiers from these: rerun `python3 tools/blender/run.py assets/bld.pharmacy/build.py --glb assets/bld.pharmacy/model.glb` and pack it.
