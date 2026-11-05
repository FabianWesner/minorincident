# Maple Hardware

Reference proportions: a wide single-storey strip shop, facade about twice wall height; flat mauve roof; warm ochre masonry and cream coping. Model uses a 10.6 m frontage, 5.6 m depth and 5.3 m parapet, with a minimal 1.4 m storefront pavement. +X is the shopfront; ground is z=0. Generic manifest placeholder dimensions are not the measured reference proportions.

Purposeful parts: physical letters and trade fascia, side community mural, crossed-tool plaque, notices, real display recesses containing paint tins and cartons, framed entrance, three jointed gooseneck lamps, two rooftop HVAC units and a vent, rooftop panel seams, masonry courses/corner quoins, cement sacks and pallet slats, crates and handcart, restrained geometric paint wear. No textures or real brands.

Roof and roof plant are one hideable assembly. Interior floor, stock and glowing backs are a separate assembly. Door_front origin is on the left vertical hinge. Lamps retain origins at their wall attachment; their light anchors reference the individual emissive mesh. Static pieces are merged by palette within each assembly. Details stand at least 3 mm above supporting surfaces. AO is baked to the ao vertex-color channel for exports. LODs retain the node/control hierarchy.

Final LODs: 9,531 triangles (11.9%) and 2,318 triangles (2.9%). LOD2 uses clean authored coarse geometry and mean baked AO, preserving the same control hierarchy. AO exports as the sole COLOR_0 with a 0.65 minimum to avoid black broad panels. optimize.mjs uses installed MIT glTF Transform packages to compact normals and AO; no external runtime decoder is needed.
