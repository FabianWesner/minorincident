# s126 L9 evacuation and red wreck

## Result

The reported HIGH road stall is reproduced by the s125 evidence and addressed through level layout. The trucks now stage on the north shoulder at `(450,10)`, `(459,10)`, and `(468,10)`. The four hidden guard soldiers take posts at `z=16`, beyond the boarding lane. The previous south-side truck row at `z=-16` made evacuees cross the dense horde behind the APC; the former south-side guard posts also occupied that egress corridor. Zombies retain their existing stats, all living evacuees remain damageable, and corpses are not removed.

Six successful native runs finished with all four living evacuees aboard and the campaign handover complete. In the LOW skilled road run, the last boarding signal was 17.02 seconds after Defense complete; all other successful road runs boarded before Defense complete. The HIGH and LOW runs reached peaks of 168 and 90 living infected respectively. No collision failures occurred. Run details are in [qa.json](./qa.json).

The D-CROSSING red pickup moved from `(465,-8.9)` to `(465,-19)` at `y=0`, clear of the barricade footprints. The source layout and checked-in generated placement agree. The before/after sheet includes the viewed s125 screenshot and an explicitly labeled authored placement plan; the after side is not a browser render.

## Verification

- `tests/engine/vehicles.test.ts`: PASS (2 tests), including the native L9 truck staging assertion.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- Focused L9 threat receipt: skilled and passive complete, 0 L9 flags in each. The command's overall status marks the one-level diagnostic as partial; the raw receipt is retained in `qa.json`.
- Six native L9 proof runs: PASS; all four living evacuees boarded and L9 handover completed within the 20-second Defense-complete window.

## Open items

- A separate HIGH dry-shortcut skilled probe with the new north-side row still left one living evacuee unboarded at 20 seconds. That route parks the destroyed APC west of the bay and leaves Okafor circling near `x=438`. Moving the truck row west to address it prevented the shortcut run from reaching evacuation startup, so that experiment was reverted. The reported HIGH road route passes; all-route coverage remains open.
- A LOW road passive seed-2 probe died before it reached evacuation. It is not counted among the six successful evacuation runs; no invulnerability was added.
- Browser after-render inspection remains unverified. The L9 vehicle campaign motion gate subsequently passed HIGH and LOW with stable source and no correction failures. The shared browser pool failed to start because it could not bind `127.0.0.1:4329` (`EPERM`); another job owned that port.
- Required remote `npm test`: PASS on runner 46.225.66.90, 105 passed / 1 skipped, 129.2 seconds within the 240-second budget.
- The full cross-level threat audit exceeded its 600-second budget during unrelated L4 stages. The focused L9 receipt itself is clean.
- `npm run layouts:build -- D-CROSSING` cannot regenerate the layout in this worktree because `assets/kit.river-terrain/model.glb` is absent. The authored source and corresponding JSON placement were updated together; the unrelated generated hash touched by the failed build was restored.

See [wreck-before-after.jpg](./wreck-before-after.jpg). Browser QA is still needed to confirm the pickup’s rendered wheel contact and resting pose, and to run the motion gate when the pool is available.

## Commit status

Implementation and report committed after focused tests, typecheck, lint, the required remote suite, and HIGH/LOW L9 vehicle motion passed. The separate shortcut evacuation and rendered wreck inspection remain open.
