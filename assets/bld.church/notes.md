# bld.church

Pale stone nave, red pitched roof with cylindrical clay rolls at LOD0/1, continuous entrance bell tower, open bell chamber with a flared bell and cross, arched windows, and visible side vestry door. LOD2 retains arches, bell, tower and closed roof slopes.

## Scale and W5 contract

- Metres, +X front, Blender Z up / exported glTF Y up, identity root transform. No sourceScale or AABB fitting.
- Measured LOD0 AABB: 18 × 13.7999 × 10.6499 m (X / Y / Z); min [-9, 2.1362001952948684e-05, -5.299961231951565], max [9, 13.79989938428616, 5.34996094584927]. Manifest tolerance is 1.5% to cover export quantization and authored tier differences.
- The local origin is fixed at the ground plane. Ground foundation: 18 × 10.6 m. Projecting balconies / eaves / steps remain inside the recorded visual bounds.
- Derive future W5 geometry from this source recipe. Preserve foundation, root/body transforms, entrance hinge and all socket positions exactly. Do not fit a damaged AABB or use generic decimation. Test projected footprint IoU ≥0.9 against this intact export, including overhangs; rubble must remain separate.
- No W5 files are declared by this intact-only batch. Future delivery belongs to this base (`model.w5[.lod1/.lod2].glb` and `<id>.w5[.lod1/.lod2].glb`), with base-owned decayVariants registration.

## Interface anchors (glTF local coordinates)

- `door_front`: [8.600000381469727, 0.25, 0.800000011920929].
- `doorway`: [8.720000267028809, 0.25, 0].
- `nav_entry`: [9, 0.25, 0].
- `roof_cutaway`: [0, 9.65999984741211, 0].
- `sign_of_life`: [-5.900000095367432, 1.7000000476837158, 5.349999904632568].
- `stairwell`: [2.5, 0.3499999940395355, 0].
- `vestry_door`: [-5.900000095367432, 0.25, 5.349999904632568].
- `vestry_hide`: [-5.900000095367432, 0.25, 3.5].

`body` owns static walls / frames / parapets / tower, `roof` owns only removable roof geometry, and `interior` retains a ground floor at every tier. `door_front` is a protected independently hinged leaf; local exported Y is the hinge axis. `roof_cutaway` is a visibility interface anchor, not a roof animation. `stairwell` locates the apartment/civic access interface; this exterior batch does not provide a navigable multi-storey interior. Door/nav routing, hide triggers, building fade, survivor cues and power switching belong to the level/runtime lanes. The closed door's collision state must follow its hinge at runtime.

Fixed root `ss_physics`: mass 0, friction .75, restitution .05, centerOfMass [0,.3,0], not pushable/kickable, not flammable, with authored `col:*` wall proxies. Collider sizes follow sslib's native Blender XYZ convention; translations are exported Y-up.

`vestry_door`, `vestry_hide`, and `sign_of_life` are empty interfaces for the L5 survivor encounter; the vestry facade door is static dressing. No emitting fixture is authored for this church.

## Reproduction and LODs

`build.py` delegates to `tools/blender/sslib/fairhaven_civic.py`, using the merged rescue-assets Scene helpers plus sslib.palette / sockets / colliders / export / AO. All LODs use explicit recipes; the distance flag runs the selected tier directly, e.g. Blender `-b --factory-startup -P tools/blender/build.py -- --asset <id> --output <path>` through the normal pipeline, or the standalone wrapper with `--glb <path> --distance-tier 2` when sslib is on PYTHONPATH. Full canonical builds export model.glb plus both authored tiers, then copy LOD0 to the pipeline output.

Large pieces are beveled at LOD0. LOD1 removes masonry relief and bevels, keeps window mullions, reduces radial segments and rail posts. LOD2 authors closed frame rings, drops mullions/fine roof fittings and returns, reduces rail posts, and retains continuous walls/roofs, glazing borders, doors and all semantic anchors. No collapse modifier or generic LOD exporter is used. Static parts merge by material within body / roof / interior / door ownership. Deterministic CPU AO is bounded to [.65,1] so vertices at shell intersections cannot blacken whole walls.

Run sequentially: `npm run assets:build -- <id>`, `npm run assets:pack -- <id>`, `npm run assets:validate -- --ids <id>`. Packing preserves authored files; do not use --regenerate.

QA: `test-results/l4-fairhaven-civic-buildings/<id>/comparison.png`, `lod-contact.png`, `game-reference-peer.png`, `cutaway.png`. Independent orchestrator acceptance remains outstanding.

Rework 10-08 (orchestrator QA): bell tower now 18.1 m tall (was 13.8; manifest dimensions.y updated, plan footprint 18 x 10.65 and all documented anchors unchanged, roof_cutaway stays at 9.66), arched open belfry with dark inner shade, steep red tile spire with cross, khaki ashlar block coursing, lit tall arched windows (shared windowGlow batch plus light:nave anchor), arched wooden door, stepped entry. Rework also fixes arch trim on negative-facing walls that used to be buried in the wall.
