# bld.town-hall.w5

Base-owned W5 delivery: `bld.town-hall` declares `decayVariants: ["w5"]`. The dotted ID provides a source wrapper and review records, with no second canonical runtime registration.

## Reproduction

`npm run assets:build -- bld.town-hall --decay w5` imports each existing `assets/bld.town-hall/model[.lod1/.lod2].glb` directly. Each tier cuts a broad, stepped blast opening from connected solids that intersect the damage volume. Geometry outside that volume survives, including tower landmarks. Distance recipes reduce glass shard polygons, rubble, bullet chips and rafters; LOD2 omits individual broken-glass cuts on far faces. No decimation, AABB fitting or source scaling.

`npm run assets:pack -- bld.town-hall` preserves both authored tiers. `npm run assets:validate -- --ids bld.town-hall` validates the base and declared W5 twins. The hard caps remain 30,000 / 12,000 / 4,000 triangles and eight draws at every tier. Batching uses sslib.export.merge_by_material with body / roof / interior / door_front ownership protected.

Outputs: `assets/bld.town-hall/model.w5[.lod1/.lod2].glb`, `public/assets/models/bld.town-hall.w5[.lod1/.lod2].glb`. The wrapper also accepts explicit `--glb` and `--distance-tier 0|1|2`.

## Same-place and runtime interfaces

The original root, body, foundation footprint, transform origin, door hinge, front marker, nav_entry and every socket remain unchanged. Exact source matrix comparisons and 5cm projected triangle-mask comparisons for all tiers are recorded in `report.json` and `test-results/l5-fairhaven-civic-w5/measurements.json`. Measured dimensions use the existing base manifest tolerance (1.5%). Rubble stays on the original lot; it does not expand the footprint.

Required anchors: `doorway`, `nav_entry`, `roof_cutaway`, `stairwell`. `door_front` retains the original hinge contract. `roof` remains removable; `interior` retains the ground floor and newly exposed slab ends belong to body.

Fixed root ss_physics and col:* proxies are inherited exactly. The blast breach is visual damage; existing door/nav routes remain the navigation contract. Level placement, survivor discovery, stairs/vestry behavior, collision state switching, smoke, fire and sounds belong to runtime lanes.

Civic lamps have intensity zero and their former glowing geometry joins the unlit blue glazing batch. The required `body_emi_windowGlow` node is retained as an empty compatibility anchor; light records point to the surviving `body_pal_uiDark` geometry. No ghost-lit windows or Blender lights are exported. A future survivor cue should attach to the existing stairwell or church sign_of_life / vestry anchors independently of civic power.

## Evidence

`test-results/l5-fairhaven-civic-w5/bld.town-hall.w5/`: reference comparison, all-side turntable, matching LOD contact sheet, game-reference-peer sheet at 135 and 190 px, and roof-hidden views. `report.json` contains production measurements. Orchestrator acceptance is independent and remains pending.
