# s87: ground cover off roads

The road observer reports **zero ground-cover intersections with road lanes across L1–L10**. The runtime removes overlapping ground-cover placements and their owned colliders before collision, navigation and pushable assembly. The deploy gate runs the observer inside the existing nightly decoration-surface check.

## Cause and fix

The PO's L10 location (1235.57,24.22), beside `D-CURE/r2-r3-seam`, was covered by `decor-cure-route-corn-4813`, centered at (1241.91,28.03). Its roughly 11 m footprint extended across the 6 m asphalt lane despite its center being beside the route. The road and lane markings showed through the crop mesh.

The farm remains on the farmland side; the authored road is retained because it is the continuous regional route and matches the chapter's progression. Full-footprint clearance removes this tile and six other L10 crop tiles that reached roads or walking crossings. Shared runtime clearance also removes 27 other road-cover placements across L2, L3, L5 and L7, including road blood decals and rubble. Collider/building records belonging to removed placements are cleared with them, preventing invisible obstacles. Zombie statistics and corpse persistence are unchanged.

## Automated deploy check

`tests/nightly/content-invariants.test.ts` prepares all ten campaign layouts with their level-specific edits and generated decoration. It independently intersects rendered ground-cover bounds with complete road lanes and asphalt/tile polygons. It includes crops, vegetation/grass patches, decals, rubble and parking/plaza tiles. L10's separately emitted atlas ground decals are checked with their rotated footprints too: all 176 clear roads. Baked micro-decoration retains the existing all-district/all-tier soil validation.

All six D-CURE region handoffs must share route endpoints. Another 180 samples cover both sides of the handoffs, at 0.05/0.5/1 m longitudinal offsets and five positions across the 6 m lane; each must belong to exactly one asphalt polygon, detecting missing or doubled paving.

The test writes `test-results/ground-cover-roads.json`. New findings fail against `tests/nightly/ground-cover-roads.baseline.json`. It runs with the placement and decoration ratchets in `npm run test:nightly:remote`, documented in [the deploy gate](../../qa/deploy-gate.md). The invariant was merged into an existing test to preserve the repository's 150-case cap.

## Offender census and visual review

[Original audit](ground-cover-roads.json): 85 placement/surface pairs covering 53 unique placements after the initial seven-crop fix. The first broad-phase sweep had 103 pairs; exact segment intersection removed one false positive in addition to the crop fixes.

[Current audit](current-ground-cover-roads.json): zero road intersections; 26 remaining intersections with broader entrance, pavement and plaza paving. These remain explicit baseline findings with IDs and coordinates. They are outside road lanes and remain visible for paving review rather than being reported as a completely clean decoration inventory.

[Final contact sheet](surface-contact-sheet.jpg) contains 60 authentic before/after pairs at HIGH quality, zoom 1: all 53 original audit locations plus the seven cleared crop locations. [Final capture index](final-capture-index.json) records coordinates, paths and revisions. Before images were captured from an isolated detached worktree at **c9a9bbbd**; after images use the fixed source. Both runs use the same capture helper, viewport and camera settings. The L5 fixture completes the cellar-exit objective before street photos, removing the cellar mask that invalidated the earlier attempt.

I opened the final sheet and individual historical L10/L5 images. The seam before image reproduces corn across asphalt/white markings; after, the lane and crosswalk are unobstructed. The other six L10 pairs show crop edges cleared from regional/service roads. L2/L3 road blood patches disappear, while entrance and pavement decals outside the lanes remain. L5/L7 road rubble disappears; plaza rubble, benches, surrounding buildings and street markings remain. Every remaining baseline coordinate has a rendered capture in the sheet. The superseded capture indexes are retained as intermediate receipts; the final index and sheet are authoritative.

## Validation

- `npm run typecheck` and `npm run lint`: pass.
- Focused nightly decoration/road observer: pass, including 176 atlas decals and all six region seams.
- Requested remote unit command: pass on 94.130.181.173, 27 files, 106 passed / one skipped, 228.1 s within the 240 s budget; inventory 150/150. This validates the final runtime road filter. Subsequent changes extend the nightly observer and capture/report tooling only.
- No deployment, push, or main-branch movement was performed.
