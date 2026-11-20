# s194 — L10 first infected frame hitch

**Status: perf pending; root cause and fix remain open.** The PO report is a frame hitch at the first infected during L10, seed 1, cure-crash checkpoint, around tick 489 (8.2 s), at player `(551.55, -0.06)`, district D-CURE near crash-machete, WebGPU high, with 7 infected alive.

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

Both runs had seven infected already alive at tick 10; the WebGPU replay was at x=581.19 at tick 489, rather than the PO's x=551.55. Thus this checkpoint trace does not establish that it reproduces the first visible spawn. The WebGL2 worst frame occurred at tick 28; its sampled categories do not account for the full interval, so its cause is unknown. The RAF sample and CPU profile are not sufficient to attribute GPU compilation or uploads. No fix or after measurement is claimed. WebGPU low admission was cancelled when load rose to 3.51 and another Vitest was running; **perf pending**. Audio was muted, so audio decode was not measured.

Earlier attempts were blocked by sandbox `spawn EPERM` and browser-pool `listen EPERM`; those restrictions have since been lifted. Raw traces are in `test-results/s194-l10hitch/` locally.

## Code review findings

L10 already has a full warm-up behind the loading card. `CrowdView` registers the cure encounter slots, schedules the L10 infected models and corpse pages, and requests warm batches. No additional warm-up was added: without a trace, adding duplicate work could increase level loading without addressing the reported frame.

## Checks

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Focused tests: not run; no cause-specific fix has been established.
- Remote `sh tools/remote/run.sh "$PWD" -- npm test`: failed before execution (exit 69; no healthy Hetzner runner and this command was ineligible for the local fallback).
- Before → after worst frame and p99: baseline above; after pending a diagnosed fix.
- Backend/tier coverage: WebGPU high and WebGL2 high traced; low remains unmeasured.

## Remaining work

Reproduce the hitch on a quiet machine, identify its dominant cost, apply the existing prewarm/buffer preparation pattern for that cost, then remeasure WebGPU high plus WebGL2 and low. Run focused tests and the remote unit suite, update this report with evidence, and commit the fix.
