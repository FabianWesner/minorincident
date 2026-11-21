# s225 — L8 enclosure dressing

## Changes

- Removed park benches, folding chairs and street lamps whose bounds intersect any of the six animal arenas.
- Replaced the gorilla cover set's red plaza pillars with dead trunks while retaining the four stable `l8-gorilla-pillar-*` IDs used by the encounter. Added solid habitat dressing for the lion, flamingo, zebra, gorilla, primate and elephant yards using existing prop assets.
- The L8 overlay filters generic enclosure lamps from the shipped district placements.
- Baked static collision for `prop.tree.dead`, which the new cover and habitat pieces use.
- Added distinct visual ground surfaces to the six arenas and shallow water surfaces to the flamingo and elephant yards, after stable placement IDs are allocated. These are a first pass, not visual acceptance.

## Follow-up for s222/s223

The four gorilla cover IDs now use `prop.tree.dead` at the original positions. The trunks have a wider visual and collision footprint than the former narrow pillars; recheck gorilla line-of-sight cover, throw paths and charge lanes during the skilled-bot pass. The existing encounter IDs and centres are unchanged.

## Verification

- Typecheck and lint: PASS after the last layout and Scene Lab edits.
- Overlay placement audit: 73 L8 placements, no duplicate IDs, no park furniture intersecting cage bounds, and no solid-placement offenders among the new placements.
- Sharded `qa:threat`: both shards completed; L8 skilled bot completes with 0 deaths. The merged audit still has six L8 acceptance flags: the moving-hit kiting floor plus five slow-follower results. See `test-results/qa-threat/README.md` and `audit.json` for detail.
- D-ZOO layout rebuild succeeded with unrestricted access. Its generated changes were discarded because deleting generator placements shifts stable IDs used by the L8 overlay; the runtime filter removes the lamps instead.
- HIGH captures ran for lion, zebra, gorilla and elephant. The gorilla image was inspected: tiled ground, bare trunks and crates still do not read as the required habitat. Flamingo and monkey fixture starts were unwalkable. Elephant reported five static overlap pairs. These captures do not satisfy visual acceptance.
- After rebuilding with the new surfaces, the HIGH gorilla scene passed its automated checks and was inspected. The tiled pattern is gone, but the earth appears almost black under night lighting and the climbing frame, ledge, viewing window, tyre swing and night-house door remain missing. Further visual work and all-cage review are required.
- Focused L8 scene gate: 0/18 rows ran; all four batches exited 75 because the headless browser pool cannot bind `127.0.0.1:4329` (`EPERM`).
- Native HIGH/LOW cage captures and visual review: not verified for the same browser-pool failure.
- Remote `npm test`: not run; `tools/remote/run.sh` found no healthy runner, and `tools/remote/scale.sh add` could not resolve the Hetzner API host because network/DNS is blocked.
- Commit: not created; visual acceptance and the required gates remain open.
