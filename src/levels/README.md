# Milestone 1 playtest

The real game's L1 uses `levelOneSlice(resolveCampaignMission(...))`. It retains the
loaded district anchors and stops after morning → diner incident → hardware
pickup → store fight. The full authored campaign graph remains available to its
existing E12 structure tests; segments 4–6 are not part of this playtest.

L1 enables the existing infected system against town colliders, with a living
cap of 15. A healthy delivery driver turns into the named runner, with three additional
runners chasing at the diner. The slice uses one corgi and collision-safe nearby
civilian routines from E08; crowd rendering binds the real male/female models. Crossing the hardware entrance retires that chase and captures the
`melee` checkpoint. D-MAIN places the real Maple Hardware model and derives the display anchor from its bounds. The display offers a temporary bat/crowbar/machete choice;
standing in its ring for three seconds, F/E, middle-click, or touch ACTION equips
that weapon in LEFT and kick in RIGHT. Then four runners and a crawler activate.
The choice is not a permanent progression unlock.

An unarmed player has no `weapons` component; Combat's internal runner is inactive,
and its held assets and aim indicators are hidden. Death restores the mission,
entity store and infected brains together, retaining the picked weapon and resetting
its ready timer. Restart returns to the unarmed morning snapshot. The result panel
ends here rather than entering upgrades or another level.

`tests/sim/missions/level-one-slice.test.ts` covers the graph, unarmed input, real
AI spawning, all choices, restore, 20-seed evasion and 20-seed slice completion.
`tests/e2e/level-one-slice.spec.ts` starts through the menus, routes with physical
mouse/touch controls, interacts and attacks through the normal device adapters,
and records incident/store performance plus desktop and iPhone-sized images.

The residential layout starts at the survivor’s porch path. Production control/sound
expanders require `?debug`; settings remain in the pause menu. Portrait uses the
7 m camera floor and a 1.25× visual hero scale, with pixel height ≥12% verified
separately from simulation collision dimensions. Performance photo setup is
separate from the continuous physical-input route.
