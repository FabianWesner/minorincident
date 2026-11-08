# r12-vehicles — vehicle feel and pushable wrecks

## Changes

1. **Keyboard car steering:** device directions are transformed through the camera into the same screen-space world heading used on foot. The car turns toward that heading with its normal steering response; it drives forward while the heading is within 90° and brakes/reverses when the requested direction is behind. This applies to every drivable car/APC. The bicycle keeps its E19-AC16 local `frame.drive` controls; this lane does not alter its steering path.
2. **APC cab presentation:** the fallback APC roof panel is opaque and a translucent front windshield is added, retaining a complete roof while keeping the driver visible through glazing. Other transport fallback presentation is unchanged.
3. **Vehicle shoves:** authored `veh.wreck` and the heavy `prop.cure-drum-stack` now have pushable physics metadata and are admitted to the existing sleeping-prop system. Contact wakes either and applies an impulse bounded by both vehicle mass/speed and prop mass; existing awake-body cap remains in force and navigation blockers update immediately after contact. The Blender source recipe supports an explicit pushable override so heavy barrels can be movable without changing the default for other heavy props.

## Evidence

- `npm run typecheck` — PASS after the metadata and barrel source changes.
- `npm run lint` — PASS after the metadata and barrel source changes.
- `npx vitest run tests/engine/vehicles.test.ts --maxWorkers=4` — PASS, 2 tests. The existing test now asserts screen-up steering despite a contradictory local `drive` frame, APC-to-wreck and APC-to-barrel-stack shoves, wake-on-contact, positive prop velocity, and nav blocker release. Existing bicycle entry/exit and transfer assertions still pass.
- `npm test -- --maxWorkers=4` — 105 passed, 2 failed (150-case budget). The A* navigation timeout passed when rerun alone with the gate-tools file; `tests/tools/gate-tools.test.ts` still fails its existing `sourceDigest: undefined` freshness expectation. Neither failure is in the touched vehicle paths.
- `npm run qa:accept -- --level L9 --skip-browser` — 0 fresh failing rows; 8 existing incomplete rows. Low/high native complete and stationary observations passed, with 5 fixture clauses and both checkpoint probes passing at each tier. The command rewrote the shared `fix51-verify` reports; those unrelated repo-wide report changes were discarded after recording this summary.
- `qa:threat` for L9 — native skilled and passive policies completed, 0 passive threat flags. It exits with the expected `PARTIAL_LEVEL_SELECTION` diagnostic because only L9 was selected.
- `npm run scene:gate` — unable to start `tsx` under this sandbox (`listen EPERM` on its IPC pipe). Running the gate runner with ESM fallback reached all four batches, but the browser pool could not start; 0/50 rows ran (exit 75).
- Headless APC capture was attempted, but the browser pool listener failed with `listen EPERM` on loopback port 4329. The in-app browser runtime also reports no browser sessions. **APC low/high at zoom 1/1.5 and real-device L9/L1/L2 visual checks remain unverified.** No capture sheet is committed.
- `tests/qa/invariants/vehicle-scenes.test.ts` — fails on L4 start vehicle 141 overlapping two `D-FAIR/bld.storefront-row:223` geometry colliders; this scenario is outside the changed code.
- Blender rebuild was attempted after the source metadata edit but Blender crashed while probing Metal in headless mode. Wreck GLBs were updated metadata-only, with unchanged mesh data; the generated physics metadata hash now matches the updated production wreck GLB.
- Drum stack authored/generated GLBs were also updated metadata-only, with unchanged mesh data. After disk pressure was raised, removed this lane's temporary `r12-*` logs, empty vehicle temp directory, raw scene-gate state, and raw L9 threat JSON receipts; shared dist caches and other lanes' outputs were left intact. Free space was 5.7 GB at the latest cleanup check (shared disk usage is changing between jobs).

## Current limitation

The PO-required visual review and real keyboard browser drive need a working headless browser pool. The local browser service is unavailable in this managed sandbox, so this lane remains open until the APC and driving captures can be reviewed in a browser-capable run.
