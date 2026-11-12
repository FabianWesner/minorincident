# s61 — APC battering ram

## Change

Removed the heavy-impact velocity reset and throttle hold. With forward throttle held, player vehicles now keep a rolling speed floor during infected contact, capped by the vehicle's current speed cap; braking and releasing throttle still work. Infected are nudged sideways out of the hull path, including persistent corpses. Ordinary infected ram contacts cost no durability for player vehicles; brute/armored/riot contacts cost 10 and elephant contacts cost 20. Hull attacks retain their existing durability cost. Rammed lightweight barriers become dynamic bodies, tumble, settle, and keep their entity, model, and collider. Failed L9 set-piece spawns retry, and a passing APC still gives its authored thrower a chance to attack.

The E31 contact rule was corrected because its previous 10/40/80/60 durability costs and “heavy contacts stop momentum” clause conflict with the PO’s 2026-11-11 battering-ram decision.

## Native ram probe

Command: `node --import tsx/esm tools/qa/diag/apc-ram-probe.ts` (L9 seed 1, low quality, 14.4 m/s entry speed; each scenario used a fresh world).

| Contact set | Minimum speed | Ram durability cost | Time to ≥90% cruise |
|---|---:|---:|---:|
| One brute | 14.49 m/s (100.6% entry) | 10 | 0 ticks |
| Six mixed, including brute and armored | 14.44 m/s (100.3% entry) | 20 total | 0 ticks |
| Twenty ordinary | 14.49 m/s (100.6% entry) | 0 | 0 ticks |

The probe separates ram-contact costs from durability lost to hull attacks. In this run, those attacks caused a further 20, 20, and 20 durability loss respectively; the ordinary ram contacts themselves remained free.

## Verification

- `node_modules/.bin/tsc --noEmit && node_modules/.bin/tsc --noEmit -p tsconfig.sim.json`: pass (the `npm run typecheck` script's compiler commands run directly).
- `node_modules/.bin/eslint src tests tools functions *.config.ts eslint.config.js`: pass.
- Full Vitest suite: 27 files, 107 tests passed in 87.63 seconds. This is the same Vitest command used by `npm test`, wrapped in the repository's test budget.
- `tests/engine/vehicles.test.ts`: pass in the focused run, including held-throttle pile movement, armour billing, boarders, thrower debris, and a persistent dynamic barrier.
- `node --import tsx/esm tools/qa/threat-audit.ts --levels L9`: L9 skilled complete; passive reached the 600-second cap and mission-failed at `approach`; 0 L9 flags. The aggregate report also has its expected `PARTIAL_LEVEL_SELECTION` fail flag. `test-results/qa-threat/L9.json` is the L9-specific receipt.
- `npm run verify -- E31`: wrapper could not start because `tsx` was denied permission to create its temporary IPC socket (`EPERM`). Its typecheck/lint checks and full test suite were run directly as above.
- The required remote `npm test` run could not start: no healthy Hetzner runner was available, and the Mac fallback only accepts plain Vitest invocations, not `npm test`.
- Headless real-input fixture play and opened captures remain unverified. Playtest could not start because the sandbox denies both `tsx` IPC socket creation and Vite's loopback bind on port 4963; no browser was launched.
- Commit could not be created: `git add` was denied creating `.git/worktrees/s61-apcnostop/index.lock`, which is outside the writable workspace. The source changes and this report remain in the worktree.

Known limitation: the native probe is a fixed-tick simulation fixture. The real-input fixture play and opened captures are still needed for completion; those need a runtime that permits the repository's local IPC socket and loopback server.

## Unrestricted continuation, 2026-11-12

The earlier sandbox blockers are resolved. `sh tools/ops/slim-worktree.sh "$PWD" --no-assets` succeeded. `npm run verify -- E31` passed (27 files, 107 tests; 155.33 s Vitest duration).

The required remote `sh tools/remote/run.sh "$PWD" -- npm test` ran on 178.104.70.127 but failed: L4 contact and world-systems cases reported failures, then the 240-second test budget terminated the suite (exit 124, 240.8 s). This requires follow-up; remote green is not established.

Real-input fixture play ran headlessly via the repository browser lock on port 4963 using `l9-before-rail-stall.json.gz`. It reached the hatch defence but failed to finish after its eight-minute cap, repeatedly showing Restart 29/30 s. Artifacts are in `test-results/playtest/s61-apcnostop`. This run does not establish the requested rolling-horde evidence. Goal remains incomplete.

## Barrier follow-up

Jersey barriers now use the persistent dynamic ram response. A moving rammed prop damages and staggers each infected it hits once per launch; subsequent rams can launch the same retained prop again. Typecheck and lint pass. The focused vehicle suite exposed a changed timing dependency: its authored thrower was still in `throw` phase with zero completed throws when the test ended (APC x=-91.92), so the suite is not green after this follow-up. Investigate the thrower scheduling/test trajectory before completion.

The thrower failure was diagnosed as late arrival: at test tick 2846 the thrower's release deadline was 2875, with the player alive at full health. Increasing the bounded route wait from 30 to 40 simulated seconds permits the same completed-throw and landing assertions to run. The focused vehicle suite now passes (2 tests, 51.94 s). No production throw timing was changed.

## Refreshed native probe after barrier changes

The probe still records 14.49 / 14.44 / 14.49 m/s minimum against 14.4 m/s entry for brute / six mixed / twenty ordinary, with 10 / 20 / 0 ram durability costs. Other damage during these runs was 50 / 120 / 100 respectively (total losses 60 / 140 / 100), superseding the earlier incidental attack totals. Recovery remained 0 ticks. The initial real-input capture `test-results/playtest/s61-apcnostop/captures/campaign-L9-t60.jpg` was opened and inspected: APC, bus, nearby infected and armour HUD are visible, but this still image does not establish continued movement through the horde.

The apparent hatch timer reset is explained by the real-input receipt: `runs-campaign.json` records 33 player deaths in eight minutes, with no recorded attacks. Each death restores the mid-crossing checkpoint and resets its hold. This is a fixture bot survival failure, not evidence that the production countdown fails to advance. Preserve the authored hatch defence; gather the remaining driving evidence from the bridge fixture instead.

## Bridge fixture and current audit

The refreshed L9 threat audit completes both skilled and passive routes with zero L9 flags (18.9 s; aggregate partial-selection flag remains). The bridge fixture ran headlessly for 60 seconds on port 4963, moving from (452,0) to (562.4,49.4), but did not finish. Opened `test-results/playtest/s61-bridge/captures/campaign-L9-t2763.jpg`: the APC is overturned near the bay with a horde behind it. This is contradictory evidence for robust driving and needs investigation; it is not accepted as passing ramming evidence.
