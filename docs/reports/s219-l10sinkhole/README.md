# s219 — L10 “The Collapse”

## Result

Beat 7 now stages a sinkhole collapse on the southern rim lane: a crater bowl blocks navigation without removing the ground collider, a solid fence marks the one-lane detour, a wrecked burning sedan and two emergency lights dress the rim, and the existing `infected.crawler` encounter is retained under its stable encounter and set-piece keys. The Voss radio line breaks into static at the rim, with a short approach warning. The old underpass, piers, and lamps were removed. Layouts and authored route points carry the geometry and detour.

The beat-7 line trigger is at x=3397. The LOW story probe measured a 20.6 s beat-6-to-7 interval and a 13.57 s longest activity gap. The previous HIGH probe completed in 1554 s with 9 deaths; its beat-6-to-7 interval was 19.27 s before the trigger move. LOW remained at 3 deaths but did not finish the route: probes capped at 2400, 2700, and 3600 seconds ended on the final arena objectives. The 3600 s run ended while killing the Mega Alpha. The route completion requirement is open.

## Verification

- Typecheck and lint passed.
- Full default Vitest: 27 files, 106 tests passed. `node --import tsx/esm tools/verify.ts E10` also passed its typecheck, lint, and test gate (183.7 s). The standard `tsx` launcher for `npm run verify -- E10` could not create its temporary IPC pipe (`EPERM`).
- Mission interactions passed (1 test); focused L10/world/mission tests passed (9 tests).
- Solid placement audit: 0 offenders across all levels.
- Threat audit: both shards merged with 0 fail flags. L10 threat stages reported tick-budget outcomes but no flags.
- The remote `npm test` runner was unavailable (no healthy Hetzner runner); local admission also rejected the wrapped `npm test`. Direct default Vitest passed as noted above.

## Open items

- LOW skilled route does not reach credits, even with a 3600 s simulation budget; it ended on “Kill the Mega Alpha” with 3 deaths. HIGH completes at the 9-death ceiling.
- Native HIGH zoom-1 frame and full sheet were not captured or visually reviewed. The headless browser pool could not bind `127.0.0.1:4329` (`EPERM`); its fallback was also blocked when process inspection returned `EPERM`.
- `qa:vehicle-campaign-motion` is unverified because the same browser-pool startup failure stopped the gate.
- HIGH beat-7 timing has not been rerun after moving its line trigger to x=3397. Before the move it was 19.27 s versus the s212g2 reference of about 20.12 s. The LOW post-change measurement is 20.6 s.
- The worktree changes could not be committed: the sandbox denied creation of `.git/worktrees/s219-l10sinkhole/index.lock` (`Operation not permitted`).
