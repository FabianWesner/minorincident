# r14-height — attacks respect walkable levels

## Changes

- Added a shared combat-level comparison for body-centre transforms (the feet/support estimate preserves same-floor behavior).
- Player melee queries, infected windups/final bite damage, L1/outbreak bites and grabs, Alpha/zoo special hits, allied NPC attacks and target selection, corgi contact damage, escort defense, and character separation now reject targets more than 0.9 m apart vertically.
- Infected spawn, movement grounding, and recovery grounding now use `DistrictWorld.supportBelow` instead of the highest surface in the X/Z column. This prevents an infected below the L10 dispersal deck from being lifted onto its 3 m top; the existing 0.2 m stair treads remain climbable.
- Infected spawns can carry an optional Y support hint for intentionally elevated placements; ordinary X/Z-only spawns start on ground-level support.
- Infected pursuing a target on another floor follow the next walkable support in that structure's collider group, so the L10 platform chase uses its stair treads one level at a time.
- Stair waypoints use walking arrival distance and individual routes; the courier's crowd flow field cannot redirect them. L1 chases, Alpha special selection, and dog pack flanking also yield to the route when the target is on another level.
- Hitscan rays test their height against the target body band, preventing flat shots from reaching an entity on a separate floor.
- Folded raised-target melee and L10 stair support/waypoint assertions into existing tests, keeping the suite within its 150-case cap. The stair assertion walks a pursuer onto the deck using the loaded L10 collision navigation. Flat-ground melee behavior remains covered by the existing combat assertions.

## Validation

- `npm run typecheck`: passed
- `npm run lint`: passed
- Focused suites (`combat`, `infected-ai`, `world-systems`, `navigation`, `npcs`): passed (24 tests)
- `npm run test:unit`: passed before the final stair steering follow-up (150/150 cases; 27 files, 107 tests); final rerun queued on Hetzner
- `sh tools/remote/run.sh "$PWD" -- npm run qa:threat`: final audit queued for `08ae3191`; compare with the separately queued `a7b70c78` baseline receipt after both complete. The baseline applies the reverse source/test diff inside the runner's private job, leaving the worktree unchanged.

## Browser QA needed

- On L10, stand on the dispersal minigun platform and confirm infected below cannot bite, grab, or land Alpha/dog/animal attacks across the deck; observe that they climb the real stairs and do not appear on the deck without using them.
- Repeat on L6 platforms, L4 walls, stairs/ramps, and vehicle roofs in campaign scenes.
- Confirm same-floor melee and threat numbers on flat ground match the prior baseline.

No browser automation was run per the lane brief.
