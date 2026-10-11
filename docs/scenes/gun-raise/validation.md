# Validation — gun-raise

Source is the corrected automatic-target-intent implementation. No specifications, tolerances, dependencies or authored balance values changed.

| Gate | Result | Evidence |
| --- | --- | --- |
| Typecheck, lint, build | PASS | Final `npm run verify -- E05` runs all three successfully. |
| Remote unit | PASS: 519/519 | [Summary and raise assertions](comparison/unit-tests.json). |
| E05 remote verification | PASS: 66 selected checks | [Summary](comparison/verify-e05-sim.json). |
| E05 browser + smoke | PASS: 32/32 | Chromium, phone orientations and WebKit; [assertions](comparison/verify-e05-browser.json). Real drawn-body clicks: 80/80 successful. |
| L3 browser level spec + raise | PASS: 5/5 | All three real-input streets, carried-loadout L4 handoff and idle/walking first shot; [assertions](comparison/browser-l3-corrected.json). |
| Gun/weapon browser regression | PASS: 10/10 | Visibility, both rigs, standing/walking NPC muzzles, cue recovery, pickup and first raise; [assertions](comparison/browser-guns-corrected.json). |
| Full remote `tests/sim` | 593/594 | All functional checks pass. Only T-E08-11-high patrol p95 fails: L3 4.142 ms > unchanged 4 ms. [Summary](comparison/sim-final-corrected.json). |
| Remote L3 level battery | 11/20; 9 failures | [Final assertions](comparison/l3-final-corrected-tests.json), [historical comparison](comparison.md). |
| Scene Lab capture matrix | 16/16 | Both rigs, campaign guns, gaits and cameras; [frame review](README.md). |

## Performance gate

The high-tier NPC patrol budget failed on both remote hosts, including repeated checks with a single Vitest worker. Two repetitions on an otherwise idle runner still failed at L3 p95 4.130 / 4.291 ms. The unchanged police-range parent `80a9d089` also fails this criterion on that same idle runner, at L2 p95 4.086 ms. The exact pre-gun-hold baseline `96dc52d0` also fails on that idle runner; see [baseline result](comparison/patrol-baseline.json). This gate is retained and reported red; no flaky-pass claim is made. All unsuccessful repetitions are saved in `comparison/patrol-*.json`.

## Timing assertions

The first tap now has a six-tick raise, so existing instantaneous-fire fixtures wait for the discharge tick. Pistol exact shots shift from 1/16/31/46/61/76 to 7/22/37/52/67/82, with the same 15-tick cadence and 60-tick reload. The gun-noise test adds assertions for silence during the raise and noise precisely on tick 7. The lamp test likewise asserts that it remains intact during preparation. Damage, range, noise radius, clipping, braking and performance bounds are unchanged.

The strict 1800-tick combat golden is repinned from `ca029b54` to `3b991b78` because player gun preparation and readiness now participate in the deterministic snapshot and the first discharge occurs six ticks later. Two independent runs must still agree and match that exact hash. The corrected selection behavior passes that same golden.

The L2 traffic and standing-police fixtures are repaired for the already-merged station-back and police-range rules; their original assertions remain intact. Details are in [comparison.md](comparison.md).

## Commands

- `npm run typecheck`, `npm run lint`, `npm run build`.
- `MI_VERIFY_REMOTE_SIM=1 ... npm run verify -- E05` under `tools/e2e-lock.sh`.
- `tools/remote/run.sh` for unit, full simulation and L3 batteries; `--maxWorkers=2`, with focused performance repetitions at one worker.
- Headless Metal Playwright on private preview ports; at most two workers, under the shared browser lock.
- `SCENE_PORT=3347 E2E_SLOTS=1 sh tools/e2e-lock.sh ... npx tsx tools/scenelab/gun-raise.ts` for final captures.

No merge or deployment.
