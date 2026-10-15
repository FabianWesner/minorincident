# Investigation and reproduction

## White shader

The original `lod-standins/evidence/cold-shader-diagnostic.json` recorded a late white mesh program. The retained fresh baseline `shader-before/webgl-low-z1.json` identifies the hierarchy `mesh_0/body/root/Scene/Group/Scene`, material `pal_picketWhite`, opaque, double-sided, vertex colours, without cast/receive shadow. This matches the mounted minigun body, but several other assets use the same hierarchy; exact attribution needs the ancestor's asset ID. The driver-cached baseline had a 9.8 ms maximum but still built the program during the walk, so it does not reproduce the original 198.8 ms compile cost.

The mounted gun previously entered the scene through `update()` / `screenshotReady()`, after `GameView.load()` had finished warm-up. The first attempted fix loads and poses it before the existing full warm-up. However, the retained `shader-first-fix` results still show a late white-body build at tick 461 in both WebGL zoom-1 cases and WebGPU high zoom 1. Low WebGL zoom 1 is fast (9.6 ms maximum) but this attempt is not accepted as a fix. The first-play regression records late program builds and asset IDs, captures the game camera, and applies the existing 50 ms desktop hitch ceiling to low as well as high.

## Arrival simulation

The baseline V8 profile covers both tiers (170.96 s). `reachPath` accounts for 107.09 s self / 129.84 s inclusive. Instrumentation found 2,019 calls but only 247 distinct grid/version/start/target/budget keys; 1,772 calls repeated a key, with individual floods touching 800,000–1,000,000 cells. See `profile-before.json`, `calibration-before.cpuprofile.gz`, and `reach-profile.json`.

A first attempt to precompute axis distances and simplify neighbor iteration did not meet the target (121.59 s high) and was removed. The final change keeps the original flood arithmetic, traversal order, tie breaking, and finite-budget behavior. It caches only the last completed unbudgeted request, keyed by the exact start cell and target coordinates. Returned paths are copied; blockers, rebakes, recentering and player perimeter changes invalidate the memo. An active resumed search is never shortcut.

`nav-reach-equivalence.test.ts` compares paths against an independent BFS oracle and checks budget call counts, fractional targets, moved-player continuation, result mutation, and all topology invalidation paths. No gameplay rules or test deadlines changed.

The retained calibration comparison includes every recorded result field with exact equality and matching SHA-256 hashes. Baseline timings include V8 sampling overhead; final timings do not. The target is independently met by the original E3b tests in the broad sweep (high 32.279 s, low 17.521 s).

## Commands

Heavy work runs on Hetzner through the existing remote launcher and timing isolation:

```sh
sh tools/remote/run.sh "$PWD" -- bash tools/remote/timing-isolated.sh node --import tsx docs/reports/astra-hitches/evidence/calibration.ts after
python3 docs/reports/astra-hitches/evidence/equivalence.py
sh tools/remote/run.sh "$PWD" --pull test-results/astra-hitches/full-suite.json -- bash tools/remote/timing-isolated.sh npx vitest run tests/unit tests/sim tests/levels --maxWorkers=4 --reporter=default --reporter=json --outputFile=test-results/astra-hitches/full-suite.json
```

Browser runs use unique ports, headless native Chrome, a fresh build, the existing browser locks and `quiet-run.sh` for timing. Quiet batches are supervised with a 1,150-second process-group bound, including queue time, so they cannot hold reservations past 20 minutes. Failed admission is recorded as unmeasured, not as a passing gate.
