# L7 bus clearance, second pass

## Change

The previous clearance step moved support soldiers around the bus’s longitudinal ends. Because the bus also moved forward, a guard could pace beside it and remain in front-bumper space. The revised step uses the GLB bake’s `4.705 m` front and `1.29 m` half-width, moves visible support soldiers to a lateral shoulder, and reasserts clearance after character separation at cleanup. During departure it also checks survivors, infected bodies, and persistent corpses; it does not hide or remove them.

The native audit measures the baked bus rectangle against actor footprints on every departure tick. Its clearance values include a `0.8 m` rendered-rig margin beyond each actor radius. Hidden passengers are excluded because they are inside the bus by design.

## Native results

All six seed/profile combinations passed on HIGH and LOW: skilled and passive profiles, seeds 1–3. Each run completed departure, sampled 540–542 ticks, and reported zero hull intersections. Minimum conservative clearances by tier/profile/seed are recorded in [`clearance.json`](clearance.json): HIGH skilled 1.300–1.303 m; HIGH passive 1.300–1.301 m; LOW skilled 1.301–1.316 m; LOW passive 1.300–1.316 m.

`npm run typecheck` and `npm run lint` passed.

## Outstanding checks

The requested rendered HIGH zoom-1 captures at 0.7 s and 3.4 s could not be produced. `tools/e2e-lock.sh` failed before acquiring a browser: the managed pool daemon could not bind its loopback port (`listen EPERM`, `/var/folders/.../mi-browser-pool.log`). No unpooled browser was launched.

The L7-only threat diagnostic completed but is not a clean gate: it reports `FOLLOWER_WAIT_UPPER_BOUND_OVER_10_PERCENT` (30.16% in the skilled route; passive is 3.45%) and labels the run partial because only L7 was selected. This remains unresolved. The prescribed remote unit suite was retried and could not start because no healthy remote runner is provisioned; the remote runner reports that it cannot execute this suite in the local Mac slot.

Accordingly, the native clearance fix is verified, but the full requested acceptance set is not yet complete. The source change should not be treated as fully closed until the rendered captures, a zero-flag L7 threat result, and remote unit suite are obtained.

## Continuation with unrestricted environment

Committed the fix as `9a17b175`. The prescribed remote `npm test` now passed unchanged on runner `46.225.66.90`: 27 files, 106 passed / 1 skipped, 209.4 seconds within the 240-second budget.

The single permitted browser was acquired through the pool with SCENE_PORT=4981 / E2E_PORT=4982. Scene loading failed before either capture with `No clear L7 encounter point at 267.5,12` from `LevelSevenEncounters.prepare` via `setupL7Group`. No second browser was launched. Rendered capture verification therefore remains incomplete for a scene-fixture reason rather than the former sandbox restriction. The threat follower-wait flag also remains open.

The failed capture fixture loads a narrow bus-area district bbox but calls the full L7 encounter preparation at the distant start (267.5,12). A replacement browser attempt requires authorization because the single allowed browser has been consumed. No captures were opened, so rendered acceptance remains unproven.
