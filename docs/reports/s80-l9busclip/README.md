# s80-l9busclip — L9 school bus/APC contact

## Change

`VehicleBody` used a 0.6 m tall Rapier chassis collider for every vehicle. That let a school bus ride over the APC while the rendered vehicle shells overlapped. The school bus and APC now use 2.1 m high native colliders, lifted to cover their rendered bodies, with modest restitution. Their existing planar footprints are unchanged. Rapier handles the contact through its normal collision response; there is no pose teleport or vehicle stat adjustment.

## Evidence

- Opened the s78 real-input capture. The yellow bus roof/body visibly intersects the APC roof and front; orange geometry fills the APC windscreen.
- `node --import tsx/esm tools/qa/s80-l9-busclip-probe.ts` passed four moving-contact fixtures (head-on, side, rear, rail-stall); maximum planar hull overlap was 0 m on every tick, below the 0.2 m limit.
- `node --import tsx/esm tools/qa/l9-bus-driver-proof.ts` passed: two telegraphed misses wrecked the bus, the APC took no damage, and the bus remained as an exploded wreck. Ram damage now requires an actual Rapier contact pair at the end of the telegraph; a missed or not-yet-contacting ram wrecks the bus instead of damaging the APC remotely.
- `npm run typecheck` and `npm run lint` passed.
- `sh tools/qa/l9-progress-regression.sh` completed without reporting a failing route; its output includes successful route receipts for primary and detour paths.
- Scene Lab high/low capture attempt was blocked before browser launch: browser-pool startup failed with `listen EPERM` on 127.0.0.1:4329. No Scene Lab sheet was produced or reviewed in this run.
- `npm run qa:threat -- --levels L9` produced `flags: []` in `test-results/qa-threat/L9.json`. The overall command exits 1 because the audit labels a one-level selection `PARTIAL_LEVEL_SELECTION`.
- `sh tools/remote/run.sh "$PWD" -- npm test` could not start: no healthy remote runner is running/provisioned, and the remote runner script does not allow this job to use the local Mac slot.

## Scene Lab row

`tests/scenes/catalog/s80-l9-bus-apc-contact.json` records the L9-crossing camera/composition at the bus/APC approach. The row still needs HIGH and LOW sheets captured and opened when the browser pool is available.

## Open work

Retry Scene Lab high/low and review both sheets, provision/start a remote test runner and complete the remote unit suite. The s67 L9 route regression produced all 18 receipts without a failing route.

## Full-access follow-up

The remote suite ran on 46.225.66.90 and finished in 185 s: 104 passed, 2 failed, 1 skipped. Both failures are in tests/engine/vehicles.test.ts (handling and entry/drive/exit). These must be resolved before committing. HIGH and LOW Scene Lab rows both ran successfully, and both sheets were opened. They show a clear APC windscreen and distinct wheels/headlights, but the bus is outside the frame throughout; these sheets do not prove vehicle contact and the fixture must be corrected. No checks remain running.

Focused failure diagnosis: local vehicles tests reproduce both remote failures. The tall school-bus collider fails the existing flip-recovery check (upright/all four wheels). Compensating for its collider-local mass-centre offset still fails upright recovery, so the current collider design is not ready. The second failure expects 120 damage after manually invoking ram resolution with noncontacting vehicle bodies; contact-based damage requires replacing that fixture with real physics contact evidence. No check remains running.

Latest focused validation: tests/engine/vehicles.test.ts passes both tests (25 s), including flip recovery and three real Rapier contact pairs costing exactly 120 armour. Upper shells are now massless, scoped to L9, and reapplied idempotently on native rebuild. Ram contact detection includes all colliders on both rigid bodies. Full remote rerun, a stronger four-case probe, and a camera containing both vehicles remain open.
