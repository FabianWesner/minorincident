# s225 — L8 enclosure dressing

## Changes

- Removed park benches, folding chairs and street lamps whose bounds intersect any of the six animal arenas.
- Replaced the gorilla cover set's red plaza pillars with dead trunks while retaining the four stable `l8-gorilla-pillar-*` IDs used by the encounter. Added solid habitat dressing for the lion, flamingo, zebra, gorilla, primate and elephant yards using existing prop assets.
- The L8 overlay filters generic enclosure lamps from the shipped district placements.
- Baked static collision for `prop.tree.dead`, which the new cover and habitat pieces use.
- The filter also removes matching authored fallback colliders, including those in the active elephant yard. Applying the L8 overlay twice now returns the same layout.
- Removed the primate yard's laundry lines after visual review showed hanging clothes.
- Added a timber climbing frame with crossbars and a tyre swing near the edge of the primate arena. Its four feet and lower bars use baked static collision; the central gate line remains open.
- Added distinct visual ground surfaces to the six arenas and shallow water surfaces to the flamingo and elephant yards, after stable placement IDs are allocated. These are a first pass, not visual acceptance.

## Follow-up for s222/s223

The four gorilla cover IDs now use `prop.tree.dead` at the original positions. The trunks have a wider visual and collision footprint than the former narrow pillars; recheck gorilla line-of-sight cover, throw paths and charge lanes during the skilled-bot pass. The existing encounter IDs and centres are unchanged.

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
- Focused L8 scene gate: 0/18 rows ran; all four batches exited 75 because the headless browser pool cannot bind `127.0.0.1:4329` (`EPERM`).
- Native HIGH/LOW cage captures and visual review: not verified for the same browser-pool failure.
- Remote `npm test`: not run; `tools/remote/run.sh` found no healthy runner, and `tools/remote/scale.sh add` could not resolve the Hetzner API host because network/DNS is blocked.
- Commit: not created; visual acceptance and the required gates remain open.
