# Game bugs found by the revised regression

1. **L9 rough-ground speed ignored the terrain cap (AC09).** The floor implementation scaled the shared 18 m/s vehicle definition everywhere, giving 10.8 m/s even on rough ground. `Vehicles` now combines the existing authored surface lookup with the 12 m/s rough cap and then applies the 0.6 floor once. Input, damage updates and checkpoint rebuilds use the same calculation, so the post-physics damage stage cannot reset the terrain cap. Other missions retain the original vehicle behavior. Regression: `T-E31-09-terrain-{road,rough}-{1000,0}` measures actual full-throttle Rapier motion.

2. **Armed L6 survivors held their old posts in L7 and stopped the campaign group (AC20).** The outbreak tick gave L6 and L8 survivor following priority over ally behavior, but omitted L7. Carried shelter officers continued holding their previous underground posts. The seed-1 campaign driver waited for the group at x≈247 and could not reach the bus. L7 now gets the same group-follow priority. Identity, health and the ally component remain preserved. Regression: `T-E31-20-armed-roster` carries an armed held-post resident and checks that the production follower moves it with the evacuation group.

3. **An L1 displaced bin stranded the seated L2 fire-engine ride (AC20).** The seed-1 aftermath restored `D-GROVE/prop.trash-bin:1291` onto the rear of the station apron. The ride's full-hull clearance query then held Engine 3 at arc length zero indefinitely. Existing continuity policy already clears old belongings out of L2's station/ride/rescue set pieces, but initial dynamic-prop restoration checked only roads. `PropSystem.install` now uses the existing `clearOfL2Script` keep-out rule for prior-level saved props too; checkpoint/tier rebuilds still preserve gameplay displacement through their existing `preserveDisplaced` flag. Regression: `T-E31-20-L1-prop` restores the exact seed-1 bin position and proves the normal bot's seated ride arrives.

## Test tooling corrections

The generic sim runner attempted to resolve a mission graph for L7, which deliberately uses direct encounter/departure systems. Its campaign path now prepares the actual carried L6 roster, follows ordinary navigation/input and the rocket pickup, and consumes the real bus `level.completed` event. The completion callback lets the regression use `completeCampaignLevel`, matching Game, including exact zoo transport. L2 now receives the campaign's actual L1 aftermath rather than discarding it in the sim loader.

The new start fixture initially exceeded the default arena rack capacity; it now applies the actual L8 campaign before boarding. The controls fixture initially drove beyond the arena slab before braking; it now keeps the drive/brake/reverse cycle within the existing slab. Neither correction changes gameplay requirements or numerical budgets.

The final AC03 audit now holds full throttle during all 300 firing ticks and asserts real movement. Its explicit handbrake is released (RMB otherwise aliases it), and the APC starts at x=-20 so the later ram target stays in the arena grid. The complete 12-case durability suite passes.

## Browser QA follow-up

The real L10 opening at 390×844 shows the unchanged Home button overlapping the upper-left of the minimap. Health/corgi/objective text remains readable and the existing handover/reload test passes. The two captures and observation are in `review.md`; the scheduler was notified for the Q3 HUD/input lane. This is not included in the three Q2 gameplay fixes or a claim of full AC17/18 approval.
