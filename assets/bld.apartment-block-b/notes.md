# bld.apartment-block-b

Five storeys, cream stucco, teal parapet and shop band. The outer balcony bays have projecting piers and slab ceilings around glazing set back from the railing; the central bays are flat windows. This creates an inset balcony rhythm distinct from A.

## Scale and W5 contract

- Metres, +X front, Blender Z up / exported glTF Y up, identity root transform. No sourceScale or AABB fitting.
- Measured LOD0 AABB: 9.9602 × 15.95 × 12.6 m (X / Y / Z); min [-4.800088552238703, 0, -6.299976578498631], max [5.160088208915949, 15.949959982600957, 6.299976578498631]. Manifest tolerance is 1.5% to cover export quantization and authored tier differences.
- The local origin is fixed at the ground plane. Ground foundation: 9.6 × 12.6 m. Projecting balconies / eaves / steps remain inside the recorded visual bounds.
- Derive future W5 geometry from this source recipe. Preserve foundation, root/body transforms, entrance hinge and all socket positions exactly. Do not fit a damaged AABB or use generic decimation. Test projected footprint IoU ≥0.9 against this intact export, including overhangs; rubble must remain separate.
- No W5 files are declared by this intact-only batch. Future delivery belongs to this base (`model.w5[.lod1/.lod2].glb` and `<id>.w5[.lod1/.lod2].glb`), with base-owned decayVariants registration.

## Interface anchors (glTF local coordinates)

- `door_front`: [4.25, 0.25, 0.6000000238418579].
- `doorway`: [4.5, 0.25, 0].
- `nav_entry`: [4.980000019073486, 0.25, 0].
- `roof_cutaway`: [0, 11.164999961853027, 0].
- `stairwell`: [2.5, 0.3499999940395355, 0].

`body` owns static walls / frames / parapets / tower, `roof` owns only removable roof geometry, and `interior` retains a ground floor at every tier. `door_front` is a protected independently hinged leaf; local exported Y is the hinge axis. `roof_cutaway` is a visibility interface anchor, not a roof animation. `stairwell` locates the apartment/civic access interface; this exterior batch does not provide a navigable multi-storey interior. Door/nav routing, hide triggers, building fade, survivor cues and power switching belong to the level/runtime lanes. The closed door's collision state must follow its hinge at runtime.

Fixed root `ss_physics`: mass 0, friction .75, restitution .05, centerOfMass [0,.3,0], not pushable/kickable, not flammable, with authored `col:*` wall proxies. Collider sizes follow sslib's native Blender XYZ convention; translations are exported Y-up.

The entry fixture exports `light:entry`: warm point, intensity 1.5, range 4 m, pool/reflect, no shadow/beam/flicker, heroPriority 1, powerGroup `fairhaven-civic`, breakable. `body_emi_windowGlow` is a required production mesh, so the emitted mesh reference survives optimization. Apartments also share a few occupied-window glow panels in this material batch. No Blender lights are exported. The runtime lane may map this group into D-FAIR's district power graph.

## Reproduction and LODs

`build.py` delegates to `tools/blender/sslib/fairhaven_civic.py`, using the merged rescue-assets Scene helpers plus sslib.palette / sockets / colliders / export / AO. All LODs use explicit recipes; the distance flag runs the selected tier directly, e.g. Blender `-b --factory-startup -P tools/blender/build.py -- --asset <id> --output <path>` through the normal pipeline, or the standalone wrapper with `--glb <path> --distance-tier 2` when sslib is on PYTHONPATH. Full canonical builds export model.glb plus both authored tiers, then copy LOD0 to the pipeline output.

Large pieces are beveled at LOD0. LOD1 removes masonry relief and bevels, keeps window mullions, reduces radial segments and rail posts. LOD2 authors closed frame rings, drops mullions/fine roof fittings and returns, reduces rail posts, and retains continuous walls/roofs, glazing borders, doors and all semantic anchors. No collapse modifier or generic LOD exporter is used. Static parts merge by material within body / roof / interior / door ownership. Deterministic CPU AO is bounded to [.65,1] so vertices at shell intersections cannot blacken whole walls.

Run sequentially: `npm run assets:build -- <id>`, `npm run assets:pack -- <id>`, `npm run assets:validate -- --ids <id>`. Packing preserves authored files; do not use --regenerate.

QA: `test-results/l4-fairhaven-civic-buildings/<id>/comparison.png`, `lod-contact.png`, `game-reference-peer.png`, `cutaway.png`. Independent orchestrator acceptance remains outstanding.
