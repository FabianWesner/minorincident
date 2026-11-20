# s194 — L10 first infected frame hitch

**Status: fix implemented; perf pending for WebGPU and low.** The PO report is a frame hitch at the first infected during L10, seed 1, cure-crash checkpoint, around tick 489 (8.2 s), at player `(551.55, -0.06)`, district D-CURE near crash-machete, WebGPU high, with 7 infected alive.

## Reproduction and trace

`tools/perf/s194-l10hitch.ts` is a headless checkpoint trace harness. It loads L10 from `cure-crash`, starts the mission, replays the existing seed-1 L10 input recording, records player position and shader build count and request-animation-frame intervals through tick 600, and samples the existing CPU categories (simulation, AI, crowd, view, render, audio, and others) along with infected counts. Run it during a quiet reservation:

```sh
E2E_UNITS=1 SCENE_PORT=5144 sh tools/perf/quiet-run.sh npx tsx tools/perf/s194-l10hitch.ts webgpu high before
```

A quiet headless run on 2026-11-20 produced these baseline numbers (1600×900, DPR 1, muted audio, seed 1):

| Backend / tier | Frames | Worst | p99 | Frames over 100 ms |
| --- | ---: | ---: | ---: | ---: |
| WebGPU high | 1,658 | 54.7 ms | 26.8 ms | 0 |
| WebGL2 high | 1,001 | 312.6 ms | 45.1 ms | 1 |

Both runs had seven infected already alive at tick 10; the WebGPU replay was at x=581.19 at tick 489, rather than the PO's x=551.55. Thus this checkpoint trace does not establish that it reproduces the first visible spawn. The WebGL2 worst interval ended at tick 28. The preceding sample at tick 10 recorded the first seven infected, ten new shader builds, and 295.3 ms in render; that render falls inside the following RAF interval. This implicates the first draw and shader/pipeline work, although the trace does not separate compilation from uploads. The loading path had prepared only the runner fallback corpse tier before play. The fix prepares the planned living tiers for the opening regular looks and crawler behind the loading card. On the same quiet trace WebGL2 high improved from 312.6 to 95.1 ms worst and 45.1 to 33.2 ms p99 (1,269 frames, no frames over 100 ms). WebGPU low admission was cancelled when load rose to 3.51 and another Vitest was running; **perf pending**. Audio was muted, so audio decode was not measured.

Earlier attempts were blocked by sandbox `spawn EPERM` and browser-pool `listen EPERM`; those restrictions have since been lifted. Raw traces are in `test-results/s194-l10hitch/` locally.

## Code review findings

L10 already has a full warm-up behind the loading card. `CrowdView` registers the cure encounter slots, schedules the L10 infected models and corpse pages, and requests warm batches. The staged startup now includes the opening regular looks and crawler at their planned tiers in the loading barrier. This can increase loading time; it has not been measured.

## Checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Focused L10 camera framing tests: 3 passed. The WebGL2 checkpoint trace above exercises the changed loading path.
- Remote `sh tools/remote/run.sh "$PWD" -- npm test`: failed before execution (exit 69; no healthy Hetzner runner and this command was ineligible for the local fallback).
- Before → after worst frame and p99: WebGL2 high above; WebGPU and low after measurements pending.
- Backend/tier coverage: WebGPU high and WebGL2 high traced; low remains unmeasured.

## Remaining work

Confirm the reported location and trigger, then remeasure WebGPU high and low and assess loading-time impact. Run focused tests and the remote unit suite, update this report with evidence, and commit the fix.
