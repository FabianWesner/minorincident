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
- An experiment moving the beat-7 x trigger from 3397 to 3382 was captured on the HIGH ordinary-input route at tick 51101, player (3382.00, 69.96). The reviewed `test-results/qa-l10-sinkhole/high-native-beat7-new.png` shows the courier beside a rail, sandbags and crates, with the crater outside the frame. The threshold change was reverted: the bot travels outside the rail, so changing x alone does not establish the requested composition. The next fix needs to address the route or camera composition and verify the resulting native frame.
- A second experiment shifted the rail from z=72 to z=68 to widen access to the rim. The HIGH native bot still crossed the original line at (3397.02, 61.29), outside the rail and farther from the crater. That geometry change was reverted. A direct player-nav grid probe confirmed the z=74 rim lane is walkable, so the issue is not simply a blocked lane.
- A HIGH native waypoint trace shows the bot reaches the rim at approximately (3380, 74), then walks back around the rail's western end and south to reach (3406, 74). Trigger experiments at (3380.03, 74.26) and after returning east at (3405.50, 85.01) were reviewed in `test-results/qa-l10-sinkhole/high-native-beat7-rim.png` and `high-native-beat7-east.png`. The first looks away from the crater; the second shows an emergency light and wrecks, with the crater mostly outside the frame. Both trigger changes were reverted. This needs a deliberate camera or layout composition rather than an x threshold alone.
- A localized follow-camera widening experiment (region scale 2 at player zoom 1) was captured at the original beat-7 trigger on the HIGH native route, player (3397.00, 62.45), tick 51494. The reviewed `test-results/qa-l10-sinkhole/high-native-beat7-wide.png` shows the fight, field and rail, but still no readable crater; the courier is substantially smaller. The camera change was reverted. Widening around the courier alone does not resolve the camera-facing direction.
- A directed follow-camera pull toward (3390, 82), with a 1.3 regional scale and beat-7 trigger at x=3380, was captured on the HIGH native route at (3380.03, 74.26), tick 50939. The reviewed `test-results/qa-l10-sinkhole/high-native-beat7-pullwide.png` shows the upper broken rim and a red lamp, but the lower bowl is clipped and the courier is high in the frame. The existing scripted pull also locks player zoom and is excluded from the simulation camera used for spawn visibility. The experiment was reverted pending a composition that addresses those effects. Its focused camera test, typecheck and lint passed before revert.
- A live HIGH trace found the cause of the southern detour: the sinkhole encounter's closed invisible gate spans x=3390, z=55–135 and cuts through the rim. At tick 51000 it was closed with no cohort admitted; the bot went around its southern end. Removing only this redundant encounter gate kept the crater, rail and cohort and brought the HIGH native bot to (3397.04, 74.09) at beat 7; the reviewed `test-results/qa-l10-sinkhole/high-native-beat7-no-wall.png` shows the broken edge and red lamp at the left, though most of the bowl is clipped. HIGH completed in 1543 s with 8 deaths, but LOW completed in 1195 s with 4 deaths, exceeding the required ceiling of 3. The gate removal was reverted. Both story probes still exited nonzero on other assertions; typecheck and lint passed for the candidate.
- Commit `4d7c6ed4` retains the encounter gate but shortens its half-width from 40 to 17 m so it meets the crater and leaves the southern rim open; cold-resume reconstruction uses the same width. LOW and HIGH ordinary-input routes completed in 1202 s / 3 deaths and 1493 s / 9 deaths respectively. Both story probes still exited nonzero on eight other ride, visibility and pacing assertions. The focused save-resume test (6 tests), mission interactions (1 test), typecheck and lint passed. Both full threat shards merged with L10 skilled complete and 0 fail flags. Two unchanged remote `npm test` attempts timed out at 241.1 and 241.7 s; the second also reported a save-progression test failure before timing out, whose full failure detail was not emitted before termination. The remote gate remains open.
- The HIGH native zoom-1 frame on `4d7c6ed4` was captured at tick 51166, player (3397.04, 74.09), when `L10.finale-7` fired. Reviewed `test-results/qa-l10-sinkhole/high-native-beat7-short-gate.png`: the courier fights on the rim beside the rail, a red emergency light and broken crater edge appear at the left, but most of the bowl remains clipped. The native composition remains an open quality issue.
