# s225 — L8 enclosure dressing

## Changes

- Removed park benches, folding chairs and street lamps whose bounds intersect any of the six animal arenas.
- Replaced the gorilla cover set's red plaza pillars with dead trunks while retaining the four stable `l8-gorilla-pillar-*` IDs used by the encounter. Added solid habitat dressing for the lion, flamingo, zebra, gorilla, primate and elephant yards using existing prop assets.
- The L8 overlay filters generic enclosure lamps from the shipped district placements.
- Baked static collision for `prop.tree.dead`, which the new cover and habitat pieces use.
- The filter also removes matching authored fallback colliders, including those in the active elephant yard. Applying the L8 overlay twice now returns the same layout.
- Removed the primate yard's laundry lines after visual review showed hanging clothes.
- Added a timber climbing frame with crossbars and a tyre swing near the edge of the primate arena. Its four feet and lower bars use baked static collision; the central gate line remains open.
- Reused that frame in the gorilla house near the north-east fence and removed one nearby dead trunk to make room. The four gorilla tactical-cover IDs remain at their existing positions.
- Replaced the three flamingo and three zebra road barriers with solid rock outcrops at the same positions and orientations. The new prop has authored LODs and baked static collision.
- Added a fixed heavy log barrier along the east side of the actual elephant yard. It uses baked static collision and leaves the truck and north/south gate lines in place.
- Replaced the zebra paddock's placeholder crates and toy pool with four solid hay feeders and a water trough, using the existing positions near the paddock edge.
- Added distinct visual ground surfaces to the six arenas and shallow water surfaces to the flamingo and elephant yards, after stable placement IDs are allocated. These are a first pass, not visual acceptance.

## Follow-up for s222/s223

The four gorilla cover IDs now use `prop.tree.dead` at the original positions. The trunks have a wider visual and collision footprint than the former narrow pillars; recheck gorilla line-of-sight cover, throw paths and charge lanes during the skilled-bot pass. The existing encounter IDs and centres are unchanged.

The flamingo and zebra cover IDs remain at their original positions but now have rock collision rather than jersey-barrier collision. Recheck flamingo landing lanes and zebra stampede sidesteps in s222 and the full L8 run.

The elephant yard now has a fixed log barrier at x106.5/z60.5. Its collider does not overlap the truck or yard fence, but its effect on charge paths should be reviewed by s223 in native play.

The zebra edge fixtures now use larger feeder and trough colliders in place of crates and a toy pool; recheck the stampede lap and turning space in s222.

## Verification

- Typecheck and lint: PASS after the last layout and Scene Lab edits.
- Overlay placement audit: 73 L8 placements, no duplicate IDs, no park furniture intersecting cage bounds, and no solid-placement offenders among the new placements.
- Follow-up filter inspection: nine base furniture placements removed, zero corresponding fallback colliders remain, and the overlay is idempotent. Typecheck and lint pass on that change.
- Sharded `qa:threat`: both shards completed; L8 skilled bot completes with 0 deaths. The merged audit still has six L8 acceptance flags: the moving-hit kiting floor plus five slow-follower results. See `test-results/qa-threat/README.md` and `audit.json` for detail.
- D-ZOO layout rebuild succeeded with unrestricted access. Its generated changes were discarded because deleting generator placements shifts stable IDs used by the L8 overlay; the runtime filter removes the lamps instead.
- HIGH captures ran for lion, zebra, gorilla and elephant. The gorilla image was inspected: tiled ground, bare trunks and crates still do not read as the required habitat. Flamingo and monkey fixture starts were unwalkable. Elephant reported five static overlap pairs. These captures do not satisfy visual acceptance.
- After rebuilding with the new surfaces, the HIGH gorilla scene passed its automated checks and was inspected. The tiled pattern is gone, but the earth appears almost black under night lighting and the climbing frame, ledge, viewing window, tyre swing and night-house door remain missing. Further visual work and all-cage review are required.
- Current HIGH zoom 1 Scene Lab fixtures ran for all six cages after fixing the flamingo and monkey fixture start positions. Reviewed frames: lion has bare trees and dark, sparse ground; flamingo has a rectangular dark pond and road barriers; zebra has a dark green empty floor and road barriers; gorilla has dark earth, trunks and crates; primate has the house, trees and laundry lines (now removed); elephant is mostly obscured by the truck and foreground bush. None establishes the requested habitat look. Scene Lab reported three static pairs in the primate crop and four in the elephant crop; their causes remain to be inspected. These are scene fixtures, not a substitute for the required native frames.
- The new climbing frame's HIGH detail capture was inspected: its timber posts, crossbars and tyre are visible. The centered primate encounter crop places most of the frame at the foreground edge, so native route review is still needed. Both captures reported zero static overlap pairs. The asset validator passes all three LODs (508, 96 and 72 triangles); typecheck and lint pass. Source LODs are reproducible with `MI_ZOO_FRAME_LOD=1` and `=2` through `tools/blender/build.py`, followed by `tools/assets/build.ts prop.zoo-climbing-frame`.
- Gorilla frame follow-up: HIGH zoom 1 detail capture was inspected and shows the frame and tyre inside the fence; it lies outside the centered encounter crop. Both Scene Lab crops reported zero static overlap pairs. An independent layout collision query found 11 frame boxes and no intersections with other static colliders. This does not establish route clearance or gorilla behavior; native play and the full gates remain necessary. Typecheck and lint pass.
- Rock cover follow-up: both HIGH zoom 1 Scene Lab frames were inspected; stone shapes replace the conspicuous barriers, but the flamingo pond still reads as a dark rectangle and the zebra floor is sparse. Both crops report zero static overlap pairs. All six placed rocks have baked collision at tiers 0–6. Asset validation passes 240/60/20 triangles for LOD0/1/2; typecheck and lint pass. Native fight and route clearance remain unverified after this geometry change.
- Pond follow-up: rebuilt D-ZOO with a rounded irregular water edge, mud bank and small island. The HIGH zoom 1 Scene Lab frame was inspected: the rectangle is gone and the bank and island are visible, though the water remains very dark at night and reeds and boardwalk still need review. Zero static overlap pairs in this crop. Generated placements, colliders, walkable data, anchors and roads compare equal to the prior district export. Typecheck and lint pass; native landing and route verification remain open.
- Elephant log follow-up: authored asset validation passes LOD0/1/2 at 144/80/24 triangles. The HIGH detail frame was inspected; the barrier is visible but dark. The scene reports four static overlap pairs already present in the earlier elephant crop; the new barrier's collider independently has no static intersections. An L8-only threat diagnostic completes the skilled run in 413.6 simulated seconds with zero deaths, but reports the moving-hit kiting failure and a skilled reachability warning; its partial selection is not a full gate. Typecheck and lint pass.
- Zebra fixture follow-up: HIGH zoom 1 detail frame inspected; a hay feeder and water trough are recognizable within the fence. Scene Lab reports zero static overlap pairs, and a layout query found one solid collider per fixture with no intersections. Asset validation passes feeder LOD0/1/2 at 156/72/24 triangles and trough at 120/72/24; typecheck and lint pass. Native stampede and route verification remain open.
- Focused L8 scene gate: 0/18 rows ran; all four batches exited 75 because the headless browser pool cannot bind `127.0.0.1:4329` (`EPERM`).
- Native HIGH/LOW cage captures and visual review: not verified for the same browser-pool failure.
- Remote `npm test`: not run; `tools/remote/run.sh` found no healthy runner, and `tools/remote/scale.sh add` could not resolve the Hetzner API host because network/DNS is blocked.
- Visual acceptance and the required gates remain open; the preceding changes are committed as incremental work.
