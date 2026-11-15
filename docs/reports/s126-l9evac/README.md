# s126 L9 evacuation and wreck placement

L9 evacuation is fixed through north-side truck staging and an approach around the gate side fence. Six native HIGH/LOW runs on the final code finish with every living evacuee aboard within 17.02 seconds of Defense complete. The actual archived s125 stalled save also reaches 4/4 aboard at full health within 16.15 seconds of Defense complete. Implementation, tests, fixture and this report are committed on the lane branch.

## Cause and change

The former truck row at z=-16 made evacuees cross the dense horde behind the APC. Trucks now stage at `(450,10)`, `(459,10)` and `(468,10)`; guard posts are north of that boarding lane at z=16. A HIGH shortcut stop discharges survivors west of the closed gate side fence, where one survivor circled indefinitely. Those survivors now first approach the fence’s north end at `(437,16)` before turning toward the trucks. Movement speed, collision, damage, zombie stats and corpse persistence are unchanged.

The red pickup overlapped the barricade at `(465,-8.9)`. It now sits at `(465,-19)`, y=0, clear of the blocks. I inspected front and rear headless WebGL after captures: the visible front and rear tires meet the road. Far-side contact is occluded, but the requested alternative of moving the wreck off the barricade is verified. All nine crossing wreck placements were checked against barricade/jersey visual footprints: zero overlaps. Authored layout source and runtime JSON agree.

[Before/after sheet](./wreck-before-after.jpg) · [QA receipts](./qa.json)

## Verification

- Six final-code native runs: HIGH shortcut skilled, HIGH road skilled, LOW road skilled, HIGH road passive, LOW shortcut passive and HIGH road seed 2 skilled. All living evacuees board within 17.02 seconds; all runs complete campaign handover. HIGH road peaks at 168 living infected; LOW road peaks at 90. Zero collision failures.
- Actual s125 state: production-decoded archived campaign, seed 1, tick 11319, 209 actors, 2/4 boarded, evacuation unfinished, APC `(468.706,-2.066)`, courier 90 HP. Preserved unchanged in `tests/fixtures/saves/qa/s126-s125-l9-stalled-trucks.json.br` (149,682 bytes). The existing headless WebGL probe restores it without actor writes or courier protection: 4/4 humans aboard at 100 HP, 105 living infected remain, no probe failures. Completion is `(300 + 2469 - 1800) / 60 = 16.15` seconds after Defense complete. I inspected its dense-horde completion capture.
- Existing vehicle engine test extended to assert north-side staging; its interrupted-boarding checks still pass at HIGH/LOW. No registered test cases added.
- Typecheck and lint pass. Exact required remote command `sh tools/remote/run.sh "$PWD" -- npm test` passes after the waypoint change: 105 passed, 1 skipped, 124.9 seconds within the 240-second budget, runner 46.225.66.90. The unchanged suite retains its 150-case inventory across configured test categories.
- Refreshed L9 threat receipt: zero skilled and passive flags, both complete. The single-level diagnostic command exits nonzero solely for `PARTIAL_LEVEL_SELECTION`; no L9 criterion fails. The attempted full cross-level audit exceeded 600 seconds during unrelated L4 stages.
- HIGH/LOW L9 vehicle motion gate passes: stable source, no correction failures. This gate was run before the final pedestrian-only fence waypoint; vehicle code and placement were unchanged by that waypoint.

## Browser QA needed and limits

WebGPU was not checked; browser evidence uses headless WebGL. Far-side pickup tires are occluded in the two captures. Archived saves retain their old truck/wreck transforms; the relocation is verified on the fresh layout. The s125 state proof is a native stepped browser fixture, while six full native runs cover fresh route behavior; it is not an input-identical replay of the original 240-second video.

Layout regeneration was attempted but cannot complete because source `assets/kit.river-terrain/model.glb` is absent in this worktree. The matching authored and runtime JSON coordinates were updated together; no unrelated generated hash was retained.
