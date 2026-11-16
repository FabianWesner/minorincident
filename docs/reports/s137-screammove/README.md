# s137-screammove

Ordinary screamer warnings are noticeable during physical movement at zoom 1. HIGH was reviewed first, then LOW. Completed on WebGL2 and WebGPU at zoom 1 and 1.5.

## Change

The existing violet source rings retain their original size/colour but last 0.8/0.9 seconds instead of 0.34/0.42 seconds. A single reusable violet screen-edge arrow points toward an off-screen scream for 1.1 seconds, updated with the moving camera and removed on disposal. Existing wave pool plus DOM marker: zero additional renderer draw calls. Simulation, zombie tuning and corpse handling are unchanged.

## Real input evidence and judgment

`tools/playtest/s137-screammove.ts` restores the existing L10 console checkpoint and places one ordinary screamer in chase state near the courier. This is explicitly bounded encounter setup, not campaign progression proof. It does not change zombie stats. Physical KeyD movement runs in real time for ten seconds; native scream noise events trigger naturally. Captures sample every 250 ms (including screenshot time). JSON records tick, player position, source projection, native events and actual renderer backend. All eight after configurations emitted two screams without browser errors.

The before control reinstates batch-110 source-ring lifetimes/colours/sizes and omits the new bearing; simulation and physical input remain identical. HIGH/WebGL2/zoom 1 contains both on-screen and off-screen before/after sequences.

Opened and inspected `sheet.jpg`, with three consecutive samples around each of two screams for every run. The first scream source is on screen near the upper edge at zoom 1 and clearly inside at zoom 1.5. Before: brief/faint violet rings are easy to lose while tracking the running courier. After: the rings remain conspicuous across consecutive frames within approximately 0.5 seconds. The second scream source is off screen (HIGH/WebGL2/zoom 1 projected x=-1.68). Opened full-size frames 26 and 27: a bright violet arrow at the left edge gives a clear bearing while the courier runs; the before sequence has no bearing. The large faint hearing-radius ring alone does not reliably give that direction. The sheet shows the same persistent source rings and off-screen arrow across HIGH/LOW and both actual backends.

Raw sequences: `test-results/s137-native-{high,low}-{webgl2,webgpu}-{1,1.5}-after/`; baseline: `test-results/s137-native-high-webgl2-1-before/`. Raw captures stay outside committed reports; JSON preserves their paths and observations. One small sheet is committed.

## Validation

- Typecheck and lint pass, including the capture tool.
- Required remote `sh tools/remote/run.sh "$PWD" -- npm test`: passed, 105 tests plus one platform skip, 27 files, 126.9 seconds, unchanged 150-case manifest.
- Existing `tools/qa/s124-screamer-ground.ts` passes on WebGPU: violet counts 0, 1621, 3340, 2060, 2142, 1990, below 5000; no browser errors. Enlarged ring sizes initially failed this regression and were restored before acceptance.
- All browser work used e2e-lock, headless, one browser at a time, ten-minute reservations, ports 5011/5012.

The result is a visual judgment from bounded native-scream movement captures, not a general campaign difficulty or performance qualification. No deployment, push or main movement was performed.
