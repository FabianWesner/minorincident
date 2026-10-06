# Fuel tanker production model

Reference is a four-axle rigid tanker (not an articulated semi): long white bonnet cab, silver elliptical capsule tank, four top manholes, red/white side rails, rear-side ladder and flame diamonds. Authored size approximately 11.265 m long, 3.16 m wide over mirrors, 4.167 m high. +X forward, +Z up; tire radius and axle height both 0.67 m.

Purposeful details: recessed grille and slats, bonnet vents, twin mirrors, split windshield and wipers, hinged doors, dual access steps, cylindrical fuel tanks and straps, shielded exhaust stacks, leaf springs, tread blocks, dished rims, hubs and lugs, tank saddles, raised seams, catwalk rails and stanchions, flanged hatches and handles, locker hardware, ladder, reflectors and lamps. Flame graphics are solid geometry on raised plates; no brands or image textures.

Static meshes join by palette material. Wheel, door and lamp assemblies retain separate named joint-origin nodes. Sockets, light and collider extras are exported. AO is baked to vertex colours before LOD export. LOD1/2 omit fine hardware before deterministic decimation, targeting 10–15% and about 3% of the hero triangle count while preserving node hierarchy.

The asset manifest currently contains generic placeholder dimensions (4.4 × 1.8 × 1.9); integration must replace them with measured production bounds. This task modifies only this asset folder.

AO is baked with deterministic Cycles rays and remapped to 0.55–1.0 for the soft diorama palette. Mesh normals are recalculated outward before beveling and baking.
