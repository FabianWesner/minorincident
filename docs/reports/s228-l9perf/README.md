# s228 — L9 drive simulation hitch

## Attribution and fix

The browser trace identifies the cost in simulation time (not rendering). A deterministic Node run of the L9 HIGH/seed-1 dry-shortcut route reproduces the tick-4082 spike at the same road position. Per-listener timings show `InfectedSystem.update()` dominates; chunk residency, physics, vehicle contacts, mission/destruction work, and cleanup stay below 0.2 ms on that tick. The infected callback is servicing several scripted cohort path searches against the shared nav grid. Its shared A* budget was 2,000 expansions per tick, allowing a synchronous search burst.

Two changes bound that work without changing population, damage, or corpse lifetime:

- L9 uses a 500-expansion per-tick A* budget. Unfinished searches retain their existing frontier and resume on later ticks.
- `NavGrid` reuses per-route interrupted-search snapshot buffers from a pool. This avoids repeatedly allocating the heap, visited-cell, parent, cost, and state copies when actors alternate use of the shared A* workspace. A snapshot returns to the pool only after its state has been restored, preserving route correctness.

## Deterministic Node fixture

`tools/sim-runner/l9-system-profile.ts` loads the production L9 composition and HIGH layouts, seed 1, `LevelNineBot` dry-shortcut route/detour, begins the mission, and records every sim tick and every `sim.tick` listener from 3,500 through 4,700 (1,201 rows). The before run used the original 2,000-expansion budget; the after run used the L9 500-expansion budget. Both used the same harness, route, seed, and nav snapshot-pool implementation.

```sh
node --import tsx/esm tools/sim-runner/l9-system-profile.ts before
node --import tsx/esm tools/sim-runner/l9-system-profile.ts after
```

| Run | p50 ms | p95 ms | p99 ms | Max ms |
| --- | ---: | ---: | ---: | ---: |
| Before | 4.63 | 37.04 | 54.63 | 178.91 |
| After | 3.50 | 12.98 | 19.21 | 143.03 |

Per-tick simulation and leading system timings:

| Tick | Before sim ms | Before leading systems ms | After sim ms | After leading systems ms |
| ---: | ---: | --- | ---: | --- |
| 4082 | 29.56 | infected AI 28.01; solids 0.21; nav cleanup 0.20; physics 0.17 | 3.41 | infected AI 2.06; solids 0.19; nav cleanup 0.19; physics 0.14 |
| 4410 | 4.26 | infected AI 2.02; destruction 0.89; solids 0.21; nav cleanup 0.14 | 4.82 | infected AI 2.33; destruction 0.95; solids 0.26; nav cleanup 0.18 |
| 4569 | 4.50 | infected AI 2.84; solids 0.28; nav cleanup 0.24; physics 0.21 | 2.97 | infected AI 2.06; solids 0.13; nav cleanup 0.12; physics 0.11 |

The Node host has GC outliers elsewhere in the 1,201-tick window (max 143.03 ms after); per-tick callback timing, p95/p99, and the targeted system measurements are retained in [node-before.json](node-before.json) and [node-after.json](node-after.json). Sampled resident infected counts are 86/70/76 before and 87/75/81 after. The change is limited to navigation search scheduling and snapshot-buffer reuse; it does not change population caps, spawn requests, stats, or corpse cleanup.

## Browser fixture

The supplied production browser evidence was HIGH WebGPU, seed 1, ticks 3,500–4,700: before 1,195 frames / p95 32.8 ms / p99 78.4 ms / max 149.9 ms; after the DistrictView-only allocation change 1,050 frames / p95 34.3 ms / p99 81 ms / max 150.4 ms / 82 hitches. The reported sim costs were tick 4082 74 ms, tick 4410 25 ms, tick 4569 51 ms.

The post-fix browser run was attempted through the required headless quiet runner:

```sh
SCENE_PORT=5252 E2E_ADMISSION_TIMEOUT_SECONDS=1200 sh tools/perf/quiet-run.sh node --import tsx/esm tools/perf/s228-l9-drive.ts after-final
```

The initial attempt exited 75 before startup. A subsequent admitted run completed: 1,354 frames, p95 30.5 ms, p99 36.7 ms, max 126.8 ms, 22 hitches, no browser errors. However, large sim spikes remain: tick 4104 reported 108.2 ms and tick 4109 65.6 ms. Further attribution and a fix are required; the browser result does not establish that the hitch is resolved.

## Gates

- `npm run typecheck`: pass.
- `npm run lint`: pass.
- `npm test`: pass locally, 27 files, 106 passed, 120.0 seconds; full 150-case inventory unchanged. `sh tools/remote/run.sh "$PWD" -- npm test`: pass on the remote runner, 27 files, 105 passed and one skipped, 217.9 seconds.
- L9 skilled HIGH, seed 1: complete in 191.23 sim seconds; 100 HP, peak 173 living infected, peak 25 resident chunks, zero collision failures.
- `npm run qa:threat`: pass in 380.8 seconds; zero fail flags. L9 skilled and passive both complete.

## Notes

The earlier DistrictView partition-allocation change remains committed in `feb1c11a`; it did not reduce the supplied browser hitch and is not the fix described here. The sim changes above address the measured Node workload. The later browser run still shows large sim spikes around tick 4104; those remain open.

## Follow-up: chunk rebuild attribution

The retained Node fixture identifies tick 4104's 140.89 ms sim cost as 135.42 ms in chunk residency. A further instrumented run measured 115.98 ms in `refreshNavigation()` of 118.86 ms for activation. The masked nav bake scanned every cell through full collision queries. Rasterizing walls first and applying the same residency mask afterward reduced that refresh to 64.12 ms, with total tick 4104 falling from 127.60 to 75.21 ms in the instrumented comparison. This is an intermediate improvement: the remaining synchronous mask scan/rebuild still hitches and requires further work. Navigation tests (4), typecheck and lint pass for this intermediate change; full gates and browser measurement must be repeated after the remaining fix.
