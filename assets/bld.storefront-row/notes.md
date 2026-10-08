# bld.storefront-row (L4 Harbor Street shops, reused as the W5 base in L5)

Source: `tools/blender/sslib/fh_storefront.py` via `sslib/fairhaven.py`; reference `assets/bld.storefront-row/reference-upscaled.png`.
Three connected 5.2 m shops (brick/bakery, mustard/books, coral/cafe), +X street front, solid massing, authored LODs
(LOD0 beveled + brick/dentil/goods detail, LOD1 no bevel and no small trim, LOD2 massing + windows/awnings/signs only).
Materials (8): brick, mustard, plaidRed, canvasTan, backpackTeal, asphalt, sidewalk, emissive windowGlow (all merged per material, 8 draws every tier).

Interface anchors for level/runtime lanes: `shop1DoorSocket..shop3DoorSocket` (front doors, street side +X),
`rear1DoorSocket..rear3DoorSocket` (back doors, -X), `front`; collider `col:walls` (one cuboid over the three shops);
lights `light:shop1Window..shop3Window` (window, powerGroup `fairhaven-storefront-row`), `light:streetLamp1/2` (point).
No roof/interior cutaway nodes (not enterable); no animated nodes. Decay twins (W5) must derive from this model and keep the exact
footprint (x -4.7..5.4, z +-8.27), pivot and the three door sockets.
