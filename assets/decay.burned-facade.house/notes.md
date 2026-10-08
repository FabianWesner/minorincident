# Localized residential fire dressing

Standing wall section, 0.43 × 2.9 × 3.6 metres in game XYZ. A continuous wall surrounds a real opening, a broad uneven char patch, broken surround and dark jagged recess; the navy roof-edge strip remains intact. Explicit LOD recipes drop siding seams, sash fragments and glass chips. No rubble, collapsed floors, new textures or dependencies.

The reference shows substantially more roof destruction; the L3 brief governs this restrained fire patch. Attach mountSocket to a standing house facade (local +X outward); windowSocket marks the opening centre. Fixed collider/physics, independent roof/body nodes and +X front anchor are exported in every tier. Light, smoke and level placement are runtime responsibilities. Edge-on turntable coverage is naturally below the generic 10% volume heuristic because this is a thin wall dressing; contact/game-camera sheets remain available.

Rebuild: npm run assets:build -- decay.burned-facade.house; npm run assets:pack -- decay.burned-facade.house; npm run assets:validate -- --ids decay.burned-facade.house.

## Rebuild 2026-10-08 (orchestrator QA reject: flat clean panel with a dark rectangle)
Rebuilt headless in Blender with the broken-masonry approach of the brick/diner facades (tools/blender/sslib/burned_ruins.py `house`, driven by burned_facades.build_set): clapboard wall with two real window holes onto a dark interior, charred frames with a broken jamb and sash, broken gable remnant on the right, collapsed left roof edge (sliding shingle slab, loose tiles) with charred rafters and a rake board on the `roof` joint, brick chimney stub with broken top, soot crown along the broken edge, soot tongues over the windows, boards/bricks/planks as debris at the base. Footprint 0.44 x 2.9 x 3.6, sockets and nodes unchanged. Tiers 1112/484/188 triangles.
