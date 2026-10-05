# Helipad production notes

The reference is a square raised landing slab with a four-by-four paved deck, segmented concrete edging, two yellow/charcoal hazard panels, yellow landing circle, white H and four amber cylindrical lights. Authoring dimensions: 10 m square, deck 0.75 m high, circle diameter 7.44 m, lamp tops 1.60 m. The entrance/approach is +X; no roof or interior applies to this open platform.

All weathering is deterministic geometry, without images or shader textures. Painted markings start at least 9 mm above the pavement; paint abrasion and crack ribbons occupy separate heights. Curb chips sit 4 mm beyond the concrete side faces. The four lamp assemblies retain their mounting pivots and separate emissive meshes, with ss_light anchors. Static geometry joins by material; LODs reduce each material mesh while retaining named nodes and anchors. Palette colors follow the published tokens.

Performance QA overrides the generic Hero ceiling with a 20k LOD0 cap for this flat asset. Tile surfaces are single quads, bevel segments are reserved for visible curb edges and lamp caps, and ring/cylinder radial density is reduced. The build asserts the 20k cap. Low LODs remove fine detail before collapse, preserve support slab geometry and use greater paint/deck depth separation for reliable distant rendering.
