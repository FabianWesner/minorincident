# s126 L9 evacuation and red wreck

## Result

The reported HIGH road stall is reproduced by the s125 evidence and addressed through level layout. The trucks now stage on the north shoulder at `(450,10)`, `(459,10)`, and `(468,10)`. The four hidden guard soldiers take posts at `z=16`, beyond the boarding lane. The previous south-side truck row at `z=-16` made evacuees cross the dense horde behind the APC; the former south-side guard posts also occupied that egress corridor. Zombies retain their existing stats, all living evacuees remain damageable, and corpses are not removed.

Six successful native runs finished with all four living evacuees aboard and the campaign handover complete. In the LOW skilled road run, the last boarding signal was 17.02 seconds after Defense complete; all other successful road runs boarded before Defense complete. The HIGH and LOW runs reached peaks of 168 and 90 living infected respectively. No collision failures occurred. Run details are in [qa.json](./qa.json).

The D-CROSSING red pickup moved from `(465,-8.9)` to `(465,-19)` at `y=0`, clear of the barricade footprints. The source layout and checked-in generated placement agree. The before/after sheet includes the viewed s125 screenshot and the actual corrected-camera headless WebGL after capture. Visible front wheels meet the ground; rear wheel contact is occluded.

## Verification

- `tests/engine/vehicles.test.ts`: PASS (2 tests), including the native L9 truck staging assertion.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- Focused L9 threat receipt: skilled and passive complete, 0 L9 flags in each. The command's overall status marks the one-level diagnostic as partial; the raw receipt is retained in `qa.json`.
- Six native L9 proof runs: PASS; all four living evacuees boarded and L9 handover completed within the 20-second Defense-complete window.

## Open items

- A separate HIGH dry-shortcut skilled probe with the new north-side row still left one living evacuee unboarded at 20 seconds. That route parks the destroyed APC west of the bay and leaves Okafor circling near `x=438`. Moving the truck row west to address it prevented the shortcut run from reaching evacuation startup, so that experiment was reverted. The reported HIGH road route passes; all-route coverage remains open.
- A LOW road passive seed-2 probe died before it reached evacuation. It is not counted among the six successful evacuation runs; no invulnerability was added.
- Corrected-camera WebGL inspection shows the relocated pickup clear of barricades and its visible front wheels at ground level. Rear wheel contact remains occluded. The L9 vehicle campaign motion gate passed HIGH and LOW with stable source and no correction failures.
- Required remote `npm test`: PASS on runner 46.225.66.90, 105 passed / 1 skipped, 129.2 seconds within the 240-second budget.
- The full cross-level threat audit exceeded its 600-second budget during unrelated L4 stages. The focused L9 receipt itself is clean.
- `npm run layouts:build -- D-CROSSING` cannot regenerate the layout in this worktree because `assets/kit.river-terrain/model.glb` is absent. The authored source and corresponding JSON placement were updated together; the unrelated generated hash touched by the failed build was restored.

See [wreck-before-after.jpg](./wreck-before-after.jpg). Browser QA is still needed to confirm the pickup’s rendered wheel contact and resting pose, from an additional camera angle.

## Commit status

Implementation and report committed after focused tests, typecheck, lint, the required remote suite, and HIGH/LOW L9 vehicle motion passed. The separate shortcut evacuation and rendered wreck inspection remain open.

## Follow-up evidence

The first scene used an incorrect actor coordinate format (`[x,y,z]` instead of `[x,z]`), placing the camera away from the wreck. Runtime GLBs are present. Correcting the camera produced the actual after capture now in the sheet; the earlier absent-pickup render is superseded.

The existing body-clear follower corner routing was also tested for evacuating survivors. It allowed Okafor to board but left Mia alive and unboarded after the 600-second native sample, with the last boarding signal 64.48 seconds after defense. That experimental code was reverted. The failed receipt is summarized in `qa.json`; this result does not establish a complete shortcut fix.

## Rear view inspection

A second headless WebGL capture (120 frames, 7.98 seconds, no reported clipping) shows the relocated pickup from the rear. I inspected both after views: the pickup is clear of barricades on the road and the visible front and rear tires meet the road. The single sheet now includes both angles. Far-side tire contact remains occluded, but the requested alternative of moving the wreck off the barricade is visually verified.
