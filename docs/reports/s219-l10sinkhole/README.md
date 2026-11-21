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
- The implementation and this report were committed as `b6acacd8`; the earlier index lock denial did not persist.

## s219b follow-up (2026-11-21)

The finale stall was in Mega phase 3 after the charge: its special branch used the shared Alpha `seek()` movement path, which retained a 46-cell route at the arena edge but made no progress. Phase 3 now uses the Mega's clearance-aware route steering and yields to the Alpha chase/breach brain if that search fails. The charge leash branch also yields on a failed route instead of holding the tick stationary.

### Verification

- Native ordinary-input L10 route completed on LOW in 1,174 s with 3 deaths and on HIGH in 1,552 s with 9 deaths. Both match the s212g2 death ceilings. Beat 7 and the sinkhole warning flags were reached in both runs.
- `qa:threat` shards 1/2 and 2/2 merged successfully: L10 skilled complete, 0 fail flags.
- `mission-interactions.test.ts`: 1 test passed.
- Local `npm test`: 27 files and 106 tests passed. `npm run typecheck` and `npm run lint` passed.
- The `l10-story.ts` route portions complete, but each run exits nonzero on 8 other story assertions: four roadblock ride/fight/remount checks, Mega visibility within three minutes, idle infected frame entry, the 7–9 minute finale duration, and 45–75 second story-beat intervals. LOW's measured finale duration was 386.5 s. These remain open against the broader pacing criteria.

### Still open

- The remote `sh tools/remote/run.sh "$PWD" -- npm test` could not run: the runner reports no healthy Hetzner worker, and its local fallback rejects this wrapped command. A direct local `npm test` passed but does not satisfy the remote-runner requirement.
- The requested native HIGH zoom-1 beat-7 frame is not captured or reviewed. The browser pool cannot bind `127.0.0.1:4329` in this sandbox (`EPERM`); the `tsx` pool launcher also fails to create its IPC pipe (`EPERM`).
- Git staging/commit is blocked because the worktree's shared `.git` metadata is read-only here (`git add` cannot create `.git/worktrees/s219b-sinkhole/index.lock`). The source change remains in the worktree.

### Continuation

- The source fix and this report were committed as `c9c4a5a7` after filesystem access was restored.
- The remote runner became available. Two unchanged remote `npm test` runs both hit the 240 s budget (246.2 s and 246.1 s, exit 124); the remote gate remains open.
- A HIGH WebGL2 zoom-1 fixture placed the courier at (3397.05, 74) as `L10.finale-7` fired. The reviewed frame is `test-results/qa-l10-sinkhole/high-z1-beat-7.png`: the courier and rail dominate the frame; the crater is mostly clipped at the left edge, with part of the rim and a red lamp visible. This injected-position fixture is not the requested native route capture and does not prove the sinkhole is in view on the skilled route. A native capture attempt did not reach the beat within its 15,000 tick limit. Visual framing and native capture remain open.
- A subsequent HIGH ordinary-input bot capture reached the line at tick 51500, player (3397.28, 62.80), with zoom 1. The reviewed `test-results/qa-l10-sinkhole/high-native-beat7.png` shows the courier fighting beside crates and a billboard; the sinkhole is outside the frame. The x-only trigger permits the line to fire on this southern path. The required sinkhole-in-view composition remains open.
- A third unchanged remote `npm test` attempt timed out at 240.8 s (exit 124); the remote gate remains open.
