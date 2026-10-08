# bld.town-hall

Symmetric two-storey brick hall, pale entrance pediment, wide four-step stair, stone corner quoins, a hipped slate roof and modest central clock tower. Clock faces appear on the +X and Blender +Y faces. Hands survive LOD2; hour ticks and roof courses do not.

## Scale and W5 contract

- Metres, +X front, Blender Z up / exported glTF Y up, identity root transform. No sourceScale or AABB fitting.
- Measured LOD0 AABB: 12.08 × 12.4001 × 16 m (X / Y / Z); min [-5.150059511093478, -0.00010681081332783449, -8], max [6.929948871964541, 12.399971531960155, 8]. Manifest tolerance is 1.5% to cover export quantization and authored tier differences.
- The local origin is fixed at the ground plane. Ground foundation: 10 × 16 plus entrance steps m. Projecting balconies / eaves / steps remain inside the recorded visual bounds.
- Derive future W5 geometry from this source recipe. Preserve foundation, root/body transforms, entrance hinge and all socket positions exactly. Do not fit a damaged AABB or use generic decimation. Test projected footprint IoU ≥0.9 against this intact export, including overhangs; rubble must remain separate.
- No W5 files are declared by this intact-only batch. Future delivery belongs to this base (`model.w5[.lod1/.lod2].glb` and `<id>.w5[.lod1/.lod2].glb`), with base-owned decayVariants registration.

## Interface anchors (glTF local coordinates)

- `door_front`: [4.650000095367432, 0.25, 0.6000000238418579].
- `doorway`: [4.900000095367432, 0.25, 0].
- `nav_entry`: [6.039999961853027, 0.25, 0].
- `roof_cutaway`: [0, 8.680000305175781, 0].
- `stairwell`: [2.5, 0.3499999940395355, 0].

`body` owns static walls / frames / parapets / tower, `roof` owns only removable roof geometry, and `interior` retains a ground floor at every tier. `door_front` is a protected independently hinged leaf; local exported Y is the hinge axis. `roof_cutaway` is a visibility interface anchor, not a roof animation. `stairwell` locates the apartment/civic access interface; this exterior batch does not provide a navigable multi-storey interior. Door/nav routing, hide triggers, building fade, survivor cues and power switching belong to the level/runtime lanes. The closed door's collision state must follow its hinge at runtime.

Fixed root `ss_physics`: mass 0, friction .75, restitution .05, centerOfMass [0,.3,0], not pushable/kickable, not flammable, with authored `col:*` wall proxies. Collider sizes follow sslib's native Blender XYZ convention; translations are exported Y-up.

The entry fixture exports `light:entry`: warm point, intensity 1.5, range 4 m, pool/reflect, no shadow/beam/flicker, heroPriority 1, powerGroup `fairhaven-civic`, breakable. `body_emi_windowGlow` is a required production mesh, so the emitted mesh reference survives optimization. Apartments also share a few occupied-window glow panels in this material batch. No Blender lights are exported. The runtime lane may map this group into D-FAIR's district power graph.

## Reproduction and LODs

`build.py` delegates to `tools/blender/sslib/fairhaven_civic.py`, using the merged rescue-assets Scene helpers plus sslib.palette / sockets / colliders / export / AO. All LODs use explicit recipes; the distance flag runs the selected tier directly, e.g. Blender `-b --factory-startup -P tools/blender/build.py -- --asset <id> --output <path>` through the normal pipeline, or the standalone wrapper with `--glb <path> --distance-tier 2` when sslib is on PYTHONPATH. Full canonical builds export model.glb plus both authored tiers, then copy LOD0 to the pipeline output.

Large pieces are beveled at LOD0. LOD1 removes masonry relief and bevels, keeps window mullions, reduces radial segments and rail posts. LOD2 authors closed frame rings, drops mullions/fine roof fittings and returns, reduces rail posts, and retains continuous walls/roofs, glazing borders, doors and all semantic anchors. No collapse modifier or generic LOD exporter is used. Static parts merge by material within body / roof / interior / door ownership. Deterministic CPU AO is bounded to [.65,1] so vertices at shell intersections cannot blacken whole walls.

Run sequentially: `npm run assets:build -- <id>`, `npm run assets:pack -- <id>`, `npm run assets:validate -- --ids <id>`. Packing preserves authored files; do not use --regenerate.

QA: `test-results/l4-fairhaven-civic-buildings/<id>/comparison.png`, `lod-contact.png`, `game-reference-peer.png`, `cutaway.png`. Independent orchestrator acceptance remains outstanding.

Rework 10-08 (orchestrator QA): clock cupola enlarged (4.4 m drum, four 3 m clock faces, corner quoins, cornice, pyramid roof; total height 15.35, manifest dimensions.y updated), four-column portico with entablature and tall pediment, alternating quoins, string course, ridge-along-Y hipped slate roof with courses, warm lit windows. Footprint and anchors unchanged.
