# Investigation and reproduction

## White shader

The original `lod-standins/evidence/cold-shader-diagnostic.json` recorded a late white mesh program. Ancestor attribution now confirms `wpn.minigun-mounted`: hierarchy `mesh_0/body/root/Scene/Group/Scene`, material `pal_picketWhite`, opaque, double-sided, vertex colours, without cast/receive shadow. The driver-cached baseline had a 9.8 ms maximum but still built the program during the walk, so it does not reproduce the original 198.8 ms compile cost.

The first attempted fix loads and poses a resident gun before the full level warm-up, but the retained `shader-first-fix` results still show a late body build at tick 461. The continuation's `load-residency-webgl-low-z1.json` explains why: the reconstructed ready checkpoint finishes with the courier at x=547, the gun nonresident and its view absent. The regression then teleports to R7. The gun therefore arrives through streaming after the level warm-up. There are zero gun node builds before the walk, and the late program uses the ordinary directional/hemisphere light list. A proposed hero-light initialization change was removed when the authored data and trace did not support it.

The final implementation passes the existing `GameView.warmHidden` callback into `MountedGunView`. Its ready promise now waits for the detached model's HDR/MSAA program compilation before assigning or exposing the model. This reuses the district streaming compile path and also covers ordinary arrival from R1 without fetching an R7 weapon at level start. Disposal is checked before and after asynchronous preparation. The two focused unit cases pass on Hetzner: they hold compilation pending and verify that the gun stays hidden, then either becomes drawable or stays retired after disposal. The browser regression records load residency and warm/late builds, captures the game camera, and retains the 50 ms hitch ceiling at both qualities. Browser acceptance of this final change is unmeasured after the binding admission cutoff; the earlier failing runs are diagnostic evidence only.

## Arrival simulation

The baseline V8 profile covers both tiers (170.96 s). `reachPath` accounts for 107.09 s self / 129.84 s inclusive. Instrumentation found 2,019 calls but only 247 distinct grid/version/start/target/budget keys; 1,772 calls repeated a key, with individual floods touching 800,000–1,000,000 cells. See `profile-before.json`, `calibration-before.cpuprofile.gz`, and `reach-profile.json`.

A first attempt to precompute axis distances and simplify neighbor iteration did not meet the target (121.59 s high) and was removed. The final change keeps the original flood arithmetic, traversal order, tie breaking, and finite-budget behavior. It caches only the last completed unbudgeted request, keyed by the exact start cell and target coordinates. Returned paths are copied; blockers, rebakes, recentering and player perimeter changes invalidate the memo. An active resumed search is never shortcut.

`nav-reach-equivalence.test.ts` compares paths against an independent BFS oracle and checks budget call counts, fractional targets, moved-player continuation, result mutation, and all topology invalidation paths. No gameplay rules or test deadlines changed.

The retained calibration comparison includes every recorded result field with exact equality and matching SHA-256 hashes. Baseline timings include V8 sampling overhead; final timings do not. The target is independently met by the original E3b tests in the earlier broad sweep (high 32.279 s, low 17.521 s), and again in the continuation sweep (high 39.784 s, low 22.572 s), without raising their deadline.

## Continuation CPU validation

The broad snapshot launched before the final renderer fix completes with 2,796 passed, eight failed and nine skipped. Its exact failures are retained in `full-suite-summary.json`: high assault p95 4.026 ms vs 4 ms; high campus p95 6.818 ms vs 4 ms; full L10, carried-prop continuity and inventory-validation timeouts; L3 newbie five deaths vs at most two; L4 tank cadence 14.117 s vs 12.8 s; and the inherited shader-trace TypeScript error fixed in `62cc5f6b`. The final-source typecheck, lint and build pass. No broad-sweep green result is claimed.

The full ordinary-input L10 route passes alone in 132.426 s against its unchanged 300 s deadline. Every recorded gameplay field equals the completed broad-run artifact: 1,570.017 gameplay seconds, zero deaths, 281 kills, 355 damage. See `full-route-recheck.json`; the paired calibration records remain the before/after optimization proof. The isolated single-worker rechecks pass high assault (13.731 s; p95 2.843 ms), high campus (29.275 s), and asset validation (162.671 s), with all assertions and limits retained; see `rechecks-summary.json` and `assault-high-recheck.json`.

L3 and L4 reproduce their exact gameplay failures in the isolated recheck. A same-revision control clears the reach memo before every request, forcing the original flood without changing production source or creating a baseline worktree. It reproduces exactly five L3 deaths and the 14.116667 s L4 interval too. Thus these two current-base failures persist without the optimization; no gameplay tuning was changed. The carried-prop continuity check passes in this control in 9.268 s against its unchanged 30 s deadline. See `cache-off-control-summary.json`, `reach-cache-off.ts`, and the extending Vitest config. This control uses one ordinary runner slot alongside the final unit job; it is a gameplay comparison, not a timing-budget acceptance run. The final-source full unit suite passes on Hetzner: 1,471 passed, seven skipped, zero failed (246 files passed, one skipped), including the fixed trace typecheck and both gun readiness cases. See `unit-final-summary.json`; the suite used one worker and took 676.01 s. Typecheck, lint and the fresh production build also pass. The completed local build and stale untracked browser artifacts were removed afterward to recover disk space; no extra local build copies or baseline worktrees were created.

## Commands

Heavy work runs on Hetzner through the existing remote launcher and timing isolation:

```sh
sh tools/remote/run.sh "$PWD" -- bash tools/remote/timing-isolated.sh node --import tsx docs/reports/astra-hitches/evidence/calibration.ts after
python3 docs/reports/astra-hitches/evidence/equivalence.py
sh tools/remote/run.sh "$PWD" --pull test-results/astra-hitches/full-suite.json -- bash tools/remote/timing-isolated.sh npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4 --reporter=default --reporter=json --outputFile=test-results/astra-hitches/full-suite.json
```

The same-revision cache-disabled control uses:

```sh
MI_RUNNER_IP=94.130.181.173 sh tools/remote/run.sh "$PWD" --pull test-results/astra-hitches/cache-off-control.json -- npx vitest run tests/levels/L3.test.ts tests/levels/L4.test.ts tests/sim/l9-campaign-continuity.test.ts --config docs/reports/astra-hitches/evidence/cache-off.vitest.config.ts --maxWorkers=1 --reporter=json --outputFile=test-results/astra-hitches/cache-off-control.json -t 'T-E21-03 |T-E22-11 |T-E31-20-L1-prop '
```

Browser runs use unique ports, headless native Chrome, a fresh build, the existing browser locks and `quiet-run.sh` for timing. Quiet batches are supervised with a 1,150-second process-group bound, including queue time, so they cannot hold reservations past 20 minutes. Failed admission is recorded as unmeasured, not as a passing gate.
