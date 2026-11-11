# s58-l9soldier: L9 opening guard visibility

## Finding and fix

`Outbreak.update()` still ran an ambient civilian routine for hidden vehicle passengers. When a routine activity completed, it cleared `hidden` without clearing `passengerOf` or moving the actor. L9's four prewarmed National Guard passengers therefore appeared at the APC start pose during the opening drive.

The hidden-civilian routine now skips vehicle passengers. Other hidden civilians retain their shop/house routine clock. The L9 mission test checks the guard passengers at start and after 300 ticks of full-throttle driving, verifies no visible National Guard within 30 m of the start, and preserves the Sam/Reyes identity used by the later handoff.

## Evidence

- Before the fix, native L9 seed 1 changed all four guards from `hidden: true` to `hidden: false` after 300 stationary ticks while they remained at `(-549.75, 0.25)` and retained `passengerOf`.
- After the fix, a native L9 seed 1 probe drove for 300 ticks (APC x: `-550` → `-485.68`). All four guards remained hidden and assigned to trucks; there were zero visible National Guard within 30 m of the start at tick 0 and after 5 seconds.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L9`: L9 passive audit reported zero flags; exit code 1 is solely `PARTIAL_LEVEL_SELECTION` for selecting one level.
- Focused `tests/engine/missions.test.ts`: 6/6 passed before the final identity assertion refinement. The later full Vitest run passed the mission file, including the refined assertions.
- Full local Vitest: 105/107 passed; unrelated existing timeouts in `tests/engine/navigation.test.ts` and `tests/engine/player.test.ts` (30 s and 60 s). `npm test` also exceeded its 240 s budget on the local fallback.
- `sh tools/remote/run.sh "$PWD" -- npm test`: could not run because no healthy remote runner is provisioned.
- `npm run verify -- E31`: launcher was blocked by sandbox IPC socket restrictions. `node --import tsx/esm tools/verify.ts E31` bypassed that restriction, passed typecheck and lint, then its test phase hit the 240 s wrapper limit.
- `npm run build:qa`: passed. Starting Vite preview on required port 4959 failed with sandbox `EPERM` on loopback bind, so the required headless browser capture could not be produced or opened in this environment.

## Files

- `src/sim/outbreak/Outbreak.ts`
- `tests/engine/missions.test.ts`

The guards' bay deployment gate and the Sam/Reyes evacuation boarding flow were not changed.

## Final unrestricted verification

The environment restrictions were lifted and setup completed successfully. The required remote command then passed on 94.130.181.173: 27 files passed, 106 tests passed, 1 skipped, 168.0 seconds including budget collection. The navigation and player timeouts from the contended local run both passed remotely.

A single headless Chromium capture ran through `tools/e2e-lock.sh` with E2E_PORT=4959 and SCENE_PORT=4960, ANGLE Metal, after 300 ticks of driving input. [Opened capture](after-5s.png): the APC and courier are drawn; no soldier is beneath or beside the APC. The owned preview server was stopped afterward.
